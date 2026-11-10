const { hasGps, dms, escapeHtml } = DroneMapper;
        function geocoderEndpoint() {
            try { return localStorage.getItem('droneMapperGeocoder') || 'https://nominatim.openstreetmap.org/reverse'; }
            catch { return 'https://nominatim.openstreetmap.org/reverse'; }
        }
        document.getElementById('geocoderSettings').addEventListener('click', () => {
            const value = prompt('URL HTTPS do serviço de geocodificação reversa compatível com Nominatim:', geocoderEndpoint());
            if (value === null) return;
            try {
                const url = new URL(value);
                if (url.protocol !== 'https:') throw new Error('Use um endereço HTTPS.');
                localStorage.setItem('droneMapperGeocoder', url.href);
                addressCache.clear();
                showError('Provedor atualizado.');
            } catch (error) { showError(`Não foi possível salvar: ${error.message}`); }
        });
        // Configuração do mapa
        const map = L.map('map').setView([-15.7801, -47.9292], 4);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Array para armazenar as fotos e marcadores
        let photos = [];
        let markers = [];
        let selectedPhotoId = null;
        let resolvingAddresses = false;
        let deferredPrompt = null;
        let isOnline = navigator.onLine;
        let offlineSimulated = false;
        let generation = 0;
        let importQueue = Promise.resolve();
        let lastAddressRequest = 0;

        // Cache de endereços
        const addressCache = new Map();

        // Elementos DOM
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const photoList = document.getElementById('photoList');
        const totalPhotosSpan = document.getElementById('totalPhotos');
        const gpsPhotosSpan = document.getElementById('gpsPhotos');
        const noGpsPhotosSpan = document.getElementById('noGpsPhotos');
        const addressesResolvedSpan = document.getElementById('addressesResolved');
        const totalWithGpsSpan = document.getElementById('totalWithGps');
        const clearBtn = document.getElementById('clearBtn');
        const exportExcelBtn = document.getElementById('exportExcelBtn');
        const resolveAddressesBtn = document.getElementById('resolveAddressesBtn');
        const errorMessage = document.getElementById('errorMessage');
        const toggleSidebar = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');
        const progressBar = document.getElementById('progressBar');
        const installBanner = document.getElementById('installBanner');
        const installBtn = document.getElementById('installBtn');
        const closeInstallBanner = document.getElementById('closeInstallBanner');
        const installHeaderBtn = document.getElementById('installHeaderBtn');
        const offlineIndicator = document.getElementById('offlineIndicator');
        const offlineTestBtn = document.getElementById('offlineTestBtn');

        // PWA Installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBanner.classList.add('show');
            installHeaderBtn.classList.remove('hidden');
        });

        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                installBanner.classList.remove('show');
                installHeaderBtn.classList.add('hidden');
            }
            
            deferredPrompt = null;
        });

        installHeaderBtn.addEventListener('click', () => {
            installBanner.classList.add('show');
        });

        closeInstallBanner.addEventListener('click', () => {
            installBanner.classList.remove('show');
        });

        // Detectar conexão
        window.addEventListener('online', () => {
            isOnline = !offlineSimulated;
            updateStats();
            offlineIndicator.classList.toggle('show', !isOnline);
            // Manter o indicador coerente com a simulação.
            if (isOnline) offlineIndicator.classList.remove('show');
            showError('Conexão restabelecida!');
        });

        window.addEventListener('offline', () => {
            isOnline = false;
            updateStats();
            offlineIndicator.classList.add('show');
            showError('Você está offline. Algumas funções podem estar limitadas.');
        });

        // Botão para testar offline
        offlineTestBtn.addEventListener('click', () => {
            offlineSimulated = !offlineSimulated;
            isOnline = navigator.onLine && !offlineSimulated;
            offlineIndicator.classList.toggle('show', !isOnline);
            offlineTestBtn.setAttribute('aria-pressed', String(offlineSimulated));
            updateStats();
            showError(offlineSimulated ? 'Busca de endereços pausada para simulação offline.' : 'Simulação offline desativada.');
        });

        function showError(msg) {
            errorMessage.style.display = 'block';
            errorMessage.textContent = msg;
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        }

        function showProgress(progress) {
            progressBar.style.transform = `scaleX(${progress})`;
        }

        function updateStats() {
            const total = photos.length;
            const withGps = photos.filter(hasGps).length;
            const withoutGps = total - withGps;
            const addressesResolved = photos.filter(p => p.address).length;

            totalPhotosSpan.textContent = total;
            gpsPhotosSpan.textContent = withGps;
            noGpsPhotosSpan.textContent = withoutGps;
            addressesResolvedSpan.textContent = addressesResolved;
            totalWithGpsSpan.textContent = withGps;

            clearBtn.disabled = total === 0;
            exportExcelBtn.disabled = withGps === 0;
            resolveAddressesBtn.disabled = withGps === 0 || resolvingAddresses || !isOnline;
        }

        // Buscar endereço
        async function fetchAddress(lat, lng) {
            if (!isOnline) {
                return null;
            }

            const endpoint = geocoderEndpoint();
            const cacheKey = `${endpoint}:${lat},${lng}`;
            
            if (addressCache.has(cacheKey)) {
                return addressCache.get(cacheKey);
            }

            try {
                const wait = Math.max(0, 1100 - (Date.now() - lastAddressRequest));
                if (wait) await new Promise(resolve => setTimeout(resolve, wait));
                if (!isOnline) return null;
                lastAddressRequest = Date.now();
                const response = await fetch(
                    `${endpoint}${endpoint.includes('?') ? '&' : '?'}format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                    {
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(15000)
                    }
                );
                
                if (!response.ok) {
                    throw new Error('Erro na consulta');
                }

                const data = await response.json();
                
                let address = '';
                if (data.error) return null;
                if (data.address) {
                    const parts = [];
                    if (data.address.road) parts.push(data.address.road);
                    if (data.address.suburb) parts.push(data.address.suburb);
                    if (data.address.city || data.address.town || data.address.village) {
                        parts.push(data.address.city || data.address.town || data.address.village);
                    }
                    if (data.address.state) parts.push(data.address.state);
                    if (data.address.country) parts.push(data.address.country);
                    
                    address = parts.join(', ') || data.display_name || null;
                } else {
                    address = data.display_name || null;
                }

                if (address) addressCache.set(cacheKey, address);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                return address;
            } catch (error) {
                console.error('Erro ao buscar endereço:', error);
                return null;
            }
        }

        // Resolver todos os endereços
        async function resolveAllAddresses() {
            if (resolvingAddresses) return;
            if (!isOnline) {
                showError('Você está offline. Conecte-se à internet para buscar endereços.');
                return;
            }

            const photosWithGps = photos.filter(p => hasGps(p) && !p.address);
            
            if (photosWithGps.length === 0) {
                showError('Todas as fotos já têm endereço!');
                return;
            }

            if (geocoderEndpoint().startsWith('https://nominatim.openstreetmap.org/')) {
                if (photosWithGps.length > 20) {
                    showError('Para lotes maiores, configure um provedor próprio no botão Provedor.');
                    return;
                }
                if (!confirm('As coordenadas serão enviadas ao Nominatim/OpenStreetMap. Use apenas lotes ocasionais pequenos e não envie locais confidenciais. Consulte a política no README. Continuar?')) return;
            }

            resolvingAddresses = true;
            resolveAddressesBtn.disabled = true;
            resolveAddressesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';

            showProgress(0);

            const currentGeneration = generation;
            let attempted = 0;
            let resolved = 0;
            for (const photo of photosWithGps) {
                try {
                    if (generation !== currentGeneration) break;
                    const address = await fetchAddress(photo.lat, photo.lng);
                    if (generation !== currentGeneration) break;
                    photo.address = address;
                    attempted++;
                    if (address) resolved++;
                    showProgress(attempted / photosWithGps.length);
                    updateStats();
                    renderPhotoList();

                    const markerObj = markers.find(m => m.photoId === photo.id);
                    if (markerObj) {
                        const popupContent = `
                            <div style="text-align: center;">
                                <img src="${photo.dataUrl}" class="popup-image" alt="${escapeHtml(photo.name)}">
                                <strong>${escapeHtml(photo.name)}</strong><br>
                                <small>${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}</small><br>
                                <small style="color: #28a745;">${escapeHtml(photo.address)}</small>
                            </div>
                        `;
                        markerObj.marker.setPopupContent(popupContent);
                    }
                } catch (error) {
                    console.error('Erro ao resolver endereço:', error);
                }
            }

            resolvingAddresses = false;
            updateStats();
            resolveAddressesBtn.innerHTML = '<i class="fas fa-search"></i> Endereços';
            showProgress(0);
            
            if (generation !== currentGeneration) return;
            showError(`Endereços resolvidos: ${resolved} de ${photosWithGps.length}`);
        }

        // Criar marcador
        function createCustomMarker(photo) {
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div class="marker-pin">
                        <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}">
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                popupAnchor: [0, -40]
            });

            const marker = L.marker([photo.lat, photo.lng], { icon }).addTo(map);

            const popupContent = `
                <div style="text-align: center;">
                    <img src="${photo.dataUrl}" class="popup-image" alt="${escapeHtml(photo.name)}">
                    <strong>${escapeHtml(photo.name)}</strong><br>
                    <small>${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}</small><br>
                    ${photo.address ? `<small style="color: #28a745;">${escapeHtml(photo.address)}</small>` : ''}
                </div>
            `;

            marker.bindPopup(popupContent);

            marker.on('click', () => {
                selectPhoto(photo.id);
            });

            return marker;
        }

        function selectPhoto(photoId) {
            selectedPhotoId = photoId;
            renderPhotoList();
            
            const photo = photos.find(p => p.id === photoId);
            if (photo && hasGps(photo)) {
                map.setView([photo.lat, photo.lng], 16);
                
                const marker = markers.find(m => m.photoId === photoId);
                if (marker && marker.marker) {
                    marker.marker.openPopup();
                }
            }
        }

        // Processar EXIF
        function processPhoto(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    
                    const photo = {
                        id: crypto.randomUUID(),
                        name: file.name,
                        file: file,
                        dataUrl: dataUrl,
                        lat: null,
                        lng: null,
                        timestamp: null,
                        address: null
                    };

                    try {
                    const started = EXIF.getData(file, function() {
                        const exifData = EXIF.getAllTags(this);
                        
                        if (exifData) {
                            photo.lat = dms(exifData.GPSLatitude, exifData.GPSLatitudeRef, 'lat');
                            photo.lng = dms(exifData.GPSLongitude, exifData.GPSLongitudeRef, 'lng');
                            if (!hasGps(photo)) { photo.lat = null; photo.lng = null; }

                            photo.timestamp = exifData.DateTime || exifData.DateTimeOriginal || null;
                        }
                        
                        resolve(photo);
                    });
                    if (started === false) reject(new Error('Formato não reconhecido pelo leitor EXIF.'));
                    } catch (error) { reject(error); }
                };
                
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // Adicionar foto
        async function addPhoto(file, currentGeneration) {
            try {
                const photo = await processPhoto(file);
                if (generation !== currentGeneration) return;
                photos.push(photo);
                
                if (hasGps(photo)) {
                    const marker = createCustomMarker(photo);
                    markers.push({
                        photoId: photo.id,
                        marker: marker
                    });
                    
                    if (markers.length === 1) {
                        map.setView([photo.lat, photo.lng], 13);
                    } else {
                        const group = L.featureGroup(markers.map(m => m.marker));
                        map.fitBounds(group.getBounds().pad(0.1));
                    }
                }
                
                renderPhotoList();
                updateStats();
                
            } catch (error) {
                console.error('Erro ao processar foto:', error);
                showError(`Erro ao processar ${file.name}: ${error.message}`);
            }
        }

        // Renderizar lista
        function renderPhotoList() {
            if (photos.length === 0) {
                photoList.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #6c757d;">
                        <i class="fas fa-cloud-upload-alt fa-3x" style="margin-bottom: 1rem;"></i>
                        <p>Arraste fotos para começar</p>
                    </div>
                `;
                return;
            }

            photoList.innerHTML = photos.map(photo => `
                <div class="photo-item ${selectedPhotoId === photo.id ? 'selected' : ''}" 
                     onclick="selectPhoto('${photo.id}')">
                    <img src="${photo.dataUrl}" class="photo-thumb" alt="${escapeHtml(photo.name)}">
                    <div class="photo-info">
                        <div class="photo-name">${escapeHtml(photo.name)}</div>
                        ${hasGps(photo) ? `
                            <div class="photo-coords">
                                <i class="fas fa-latitude"></i> ${photo.lat.toFixed(6)}<br>
                                <i class="fas fa-longitude"></i> ${photo.lng.toFixed(6)}
                            </div>
                            ${photo.address ? `
                                <div class="photo-address">
                                    <i class="fas fa-map-pin"></i> ${escapeHtml(photo.address.substring(0, 50))}${photo.address.length > 50 ? '...' : ''}
                                </div>
                            ` : ''}
                        ` : `
                            <span class="no-gps-badge">
                                <i class="fas fa-exclamation-triangle"></i> Sem coordenadas GPS
                            </span>
                        `}
                    </div>
                </div>
            `).join('');
        }

        // Gerar Excel
        function generateExcel() {
            const photosWithGps = photos.filter(hasGps);
            
            if (photosWithGps.length === 0) {
                showError('Não há fotos com GPS para gerar relatório');
                return;
            }

            const data = photosWithGps.map((photo, index) => ({
                'Nº': index + 1,
                'Nome do Arquivo': photo.name,
                'Latitude': photo.lat,
                'Longitude': photo.lng,
                'Endereço': photo.address || (isOnline ? 'Não consultado' : 'Offline'),
                'Data/Hora (EXIF)': photo.timestamp || 'Não disponível',
                'Link Google Maps': `https://www.google.com/maps?q=${photo.lat},${photo.lng}`,
                'Link OpenStreetMap': `https://www.openstreetmap.org/?mlat=${photo.lat}&mlon=${photo.lng}`
            }));

            const summary = {
                'Nº': 'RESUMO',
                'Nome do Arquivo': `Total de fotos com GPS: ${photosWithGps.length}`,
                'Latitude': `Endereços resolvidos: ${photosWithGps.filter(p => p.address).length}`,
                'Longitude': '',
                'Endereço': '',
                'Data/Hora (EXIF)': '',
                'Link Google Maps': '',
                'Link OpenStreetMap': ''
            };

            data.unshift(summary);
            data.unshift({});

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data, { header: ['Nº', 'Nome do Arquivo', 'Latitude', 'Longitude', 'Endereço', 'Data/Hora (EXIF)', 'Link Google Maps', 'Link OpenStreetMap'] });

            const colWidths = [
                { wch: 5 },
                { wch: 40 },
                { wch: 15 },
                { wch: 15 },
                { wch: 60 },
                { wch: 20 },
                { wch: 30 },
                { wch: 30 }
            ];
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Fotos Drone');

            const date = new Date();
            const fileName = `relatorio_drone_${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}.xlsx`;

            XLSX.writeFile(wb, fileName);
            
            showError('Relatório Excel gerado com sucesso!');
        }

        // Limpar tudo
        function clearAll() {
            generation++;
            photos = [];
            markers.forEach(m => map.removeLayer(m.marker));
            markers = [];
            selectedPhotoId = null;
            // Manter o cache de consultas durante a sessão para evitar repetição.
            renderPhotoList();
            updateStats();
            map.setView([-15.7801, -47.9292], 4);
        }

        function importFiles(files) {
            const currentGeneration = generation;
            for (const file of files) {
                importQueue = importQueue.then(async () => {
                    if (generation !== currentGeneration) return;
                    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|tiff?)$/i.test(file.name)) {
                        showError(`${file.name} não é uma imagem válida`);
                        return;
                    }
                    await addPhoto(file, currentGeneration);
                }).catch(error => showError(`Falha na importação: ${error.message}`));
            }
        }

        // Event listeners
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInput.click();
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            importFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            importFiles(files);
            fileInput.value = '';
        });

        clearBtn.addEventListener('click', clearAll);
        exportExcelBtn.addEventListener('click', generateExcel);
        resolveAddressesBtn.addEventListener('click', resolveAllAddresses);

        toggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const icon = toggleSidebar.querySelector('i');
            icon.className = sidebar.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            setTimeout(() => map.invalidateSize(), 300);
        });

        window.selectPhoto = selectPhoto;

        offlineIndicator.classList.toggle('show', !isOnline);
        // Inicializar
        updateStats();
        renderPhotoList();

        window.addEventListener('resize', () => {
            map.invalidateSize();
        });
