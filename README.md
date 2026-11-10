# Drone Photo Mapper

![WebGIS: Leaflet 1.9.4](https://img.shields.io/badge/WebGIS-Leaflet%201.9.4-forestgreen)
![Metadados: EXIF GPS](https://img.shields.io/badge/Metadados-EXIF%20GPS-blue)
![Relatório: Excel](https://img.shields.io/badge/Relat%C3%B3rio-Excel-217346)
![Tecnologia: JavaScript](https://img.shields.io/badge/Tecnologia-JavaScript-F7DF1E)
[![Autoria: Rebeca Diniz Moura](https://img.shields.io/badge/Autoria-Rebeca%20Diniz%20Moura-8b5cf6)](https://github.com/RebecaGis)

**Das fotos ao mapa, do mapa ao relatório.**

Organize registros fotográficos de drone, visualize os pontos de captura e gere uma planilha com coordenadas, datas e links de localização. A leitura das imagens acontece no navegador, sem backend e sem envio das fotos para um servidor.

## O que você pode fazer

| Etapa | Resultado |
| --- | --- |
| Selecionar ou arrastar fotos | Lista de imagens, miniaturas e contadores |
| Ler os metadados EXIF | Coordenadas GPS e data/hora disponíveis no arquivo |
| Explorar o mapa | Marcadores com miniatura e seleção sincronizada com a lista |
| Consultar endereços, opcionalmente | Geocodificação reversa dos pontos |
| Exportar Excel | Nome, latitude, longitude, endereço, data e links Google Maps/OpenStreetMap |

Fotos sem GPS continuam na lista, mas não geram marcadores nem linhas no relatório de coordenadas. O aplicativo localiza o **ponto da câmera**: não calcula a área coberta pela fotografia, ortomosaicos ou a trajetória real de voo.

## Comece em um minuto

Baixe esta branch e abra um terminal na pasta do projeto. Com Python 3 instalado:

```bash
python -m http.server 8000
```

Abra **http://localhost:8000** e selecione fotos com EXIF GPS, preferencialmente JPEGs originais. Imagens reenviadas por aplicativos de mensagem ou editadas podem perder os metadados. Outros formatos dependem do suporte do navegador e do leitor EXIF.

O projeto não precisa de `npm install` ou build. Use um servidor local; abrir por `file://` não oferece o mesmo suporte a service worker e instalação.

## Fluxo de uso

1. Importe as fotos pelo seletor ou arrastando os arquivos.
2. Confira os contadores de fotos com e sem GPS.
3. Clique em uma foto ou marcador para inspecionar a localização.
4. Se necessário, use **Endereços** para consultar o provedor configurado.
5. Use **Excel** para baixar o relatório antes de fechar ou limpar a sessão.

## Privacidade e serviços externos

- **Imagens:** permanecem na memória da página; não são salvas automaticamente nem enviadas pelo aplicativo. Recarregar ou fechar a aba encerra a sessão.
- **Mapa base:** o navegador solicita tiles ao OpenStreetMap.
- **Endereços:** somente ao acionar a consulta, as coordenadas são enviadas ao provedor selecionado. Não envie locais confidenciais ao serviço público.
- **Bibliotecas:** Leaflet, EXIF.js, Font Awesome e SheetJS são carregadas por CDN.
- **Preferências:** o endereço do provedor pode ser salvo no `localStorage`. O cache de resultados existe apenas durante a sessão.

### Provedor de endereços

O botão **Provedor** aceita uma URL HTTPS de geocodificação reversa compatível com Nominatim. Assim você pode trocar de serviço sem alterar o aplicativo. O provedor precisa aceitar chamadas do navegador (CORS) e responder no formato esperado.

O serviço público padrão tem capacidade limitada. Use apenas pequenos lotes ocasionais, uma instância por vez; o aplicativo limita cada lote público a 20 fotos e espaça as consultas. O limite de 20 é uma escolha deste aplicativo, não uma autorização do provedor. O limite público é de **1 requisição por segundo no total por aplicação**, incluindo todos os usuários. Não use a instância pública para processamento regular, grandes lotes ou múltiplos usuários simultâneos: configure um serviço adequado. Leia a [política oficial do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

## Instalação e conexão

O projeto inclui manifesto e service worker reais. A opção de instalar depende do navegador, dos ícones aceitos e de uma origem segura (HTTPS ou localhost).

Arquivos da interface e bibliotecas já carregadas podem ser reutilizados do cache após o service worker assumir o controle. **A disponibilidade offline é parcial:** primeira abertura, mapas base e consulta de endereços dependem de rede. O botão de teste offline pausa a geocodificação; ele não desliga a conexão do navegador.

## Estrutura do projeto

```text
index.html                 Interface e estilos
app.js                     Importação, mapa, endereços e exportação
core.js                    Validação GPS e tratamento de texto
manifest.webmanifest       Metadados de instalação
service-worker.js          Cache da aplicação e bibliotecas
icon.svg                   Ícone do aplicativo
tests/core.test.cjs         Testes automatizados
localizador.html           Entrada compatível com o caminho anterior
Drone Photo Mapper/        Entrada compatível com a pasta anterior
```

As entradas antigas compartilham o mesmo JavaScript. O ponto de entrada recomendado é `index.html` na raiz.

## Verificações

Com uma versão recente do Node.js:

```bash
npm test
```

Os testes cobrem coordenadas zero e inválidas, hemisférios, seleção por ID, texto em nomes de arquivo, dados exportados, falha de geocodificação e limpeza durante leitura pendente. A exportação é verificada com uma biblioteca simulada; arquivos Excel reais e instalação precisam de validação em navegador.

## Evolução desta versão

As melhorias foram feitas a partir do arquivo local fornecido pela autora em 10/11/2026. Consulte [o registro de alterações](CHANGELOG.md). A pasta original da área de trabalho foi preservada.

## Créditos e licença

Desenvolvido por **Rebeca Diniz Moura**. Mapa base © contribuidores do OpenStreetMap. Bibliotecas e dados externos têm suas próprias licenças e condições de uso. O repositório de origem não tinha arquivo de licença identificado; esta atualização não atribui uma licença ao código sem decisão da autora.
