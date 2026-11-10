(function (root) {
    'use strict';
    function hasGps(photo) {
        return Number.isFinite(photo.lat) && Number.isFinite(photo.lng) &&
            Math.abs(photo.lat) <= 90 && Math.abs(photo.lng) <= 180;
    }
    function dms(values, reference, axis) {
        if (!Array.isArray(values) || values.length < 3) return null;
        const parts = values.map(Number);
        const ref = String(reference || '').toUpperCase();
        const max = axis === 'lat' ? 90 : 180;
        if (!(axis === 'lat' ? ['N', 'S'] : ['E', 'W']).includes(ref) ||
            parts.some(x => !Number.isFinite(x) || x < 0) ||
            parts[1] >= 60 || parts[2] >= 60) return null;
        let result = parts[0] + parts[1] / 60 + parts[2] / 3600;
        if (result > max) return null;
        return ['S', 'W'].includes(ref) ? -result : result;
    }
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }
    const api = { hasGps, dms, escapeHtml };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.DroneMapper = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
