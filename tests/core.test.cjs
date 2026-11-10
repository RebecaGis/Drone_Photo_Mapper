const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../core.js');
test('GPS aceita Equador e Greenwich e rejeita valores inválidos', () => {
    assert.ok(core.hasGps({ lat: 0, lng: 0 }));
    for (const lat of [null, NaN, Infinity, 91, '0']) assert.equal(core.hasGps({ lat, lng: 1 }), false);
    assert.equal(core.hasGps({ lat: 1, lng: -181 }), false);
});
test('DMS respeita hemisfério, exige referência e valida minutos/segundos', () => {
    assert.equal(core.dms([23, 30, 0], 'S', 'lat'), -23.5);
    assert.equal(core.dms([0, 0, 0], 'E', 'lng'), 0);
    assert.equal(core.dms([23, 30, 0], undefined, 'lat'), null);
    assert.equal(core.dms([0, 60, 0], 'N', 'lat'), null);
    assert.equal(core.dms([180, 1, 0], 'W', 'lng'), null);
});
test('texto vindo de nomes/endereços não é tratado como HTML', () => {
    assert.equal(core.escapeHtml('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
function environment() {
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, innerHTML: '' });
        return elements.get(id);
    };
    let selection;
    let rows;
    const map = { setView(coords) { selection = coords; return this; }, removeLayer() {}, invalidateSize() {} };
    const context = vm.createContext({
        DroneMapper: core, navigator: { onLine: true }, window: { addEventListener() {} },
        document: { getElementById: element },
        L: { map: () => map, tileLayer: () => ({ addTo() {} }) },
        setTimeout: callback => { callback(); }, console, crypto: require('node:crypto').webcrypto,
        AbortSignal, confirm: () => true, fetch: async () => { throw new Error('offline simulado'); },
        XLSX: { utils: { book_new: () => ({}), json_to_sheet: data => { rows = data; return {}; }, book_append_sheet() {} }, writeFile() {} }
    });
    const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    new vm.Script(source).runInContext(context);
    return { context, element, selection: () => selection, rows: () => rows };
}
test('seleção funciona com ID string e GPS zero; exportação preserva coordenadas', () => {
    const env = environment();
    vm.runInContext(`photos = [{ id:'foto-1', name:'<teste>.jpg', lat:0, lng:0, dataUrl:'data:image/jpeg;base64,AA', address:null }]; selectPhoto('foto-1'); generateExcel();`, env.context);
    assert.deepEqual(Array.from(env.selection()), [0, 0]);
    assert.ok(env.element('photoList').innerHTML.includes('&lt;teste&gt;.jpg'));
    assert.equal(env.rows()[2].Latitude, 0);
    assert.equal(env.rows()[2].Longitude, 0);
});
test('falha na geocodificação não fica salva como endereço e permite nova tentativa', async () => {
    const env = environment();
    vm.runInContext(`photos = [{id:'x',name:'x.jpg',lat:0,lng:1,dataUrl:'',address:null}];`, env.context);
    await vm.runInContext('resolveAllAddresses()', env.context);
    assert.equal(vm.runInContext('photos[0].address', env.context), null);
    assert.equal(vm.runInContext('addressCache.size', env.context), 0);
    assert.equal(env.element('resolveAddressesBtn').disabled, false);
});
test('limpar enquanto uma foto é lida impede que ela reapareça depois', async () => {
    const env = environment();
    const pending = vm.runInContext(`
        processPhoto = () => new Promise(resolve => { globalThis.finishReading = resolve; });
        addPhoto({name:'tardia.jpg'}, generation);
    `, env.context);
    vm.runInContext(`clearAll(); finishReading({id:'tardia',name:'tardia.jpg',lat:null,lng:null});`, env.context);
    await pending;
    assert.equal(vm.runInContext('photos.length', env.context), 0);
});
