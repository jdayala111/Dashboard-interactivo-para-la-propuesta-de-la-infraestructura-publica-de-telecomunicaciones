// ═══════════════════════════════════════════════
// Variables Globales y Estado
// ═══════════════════════════════════════════════
let dataD1 = [], dataD2 = [], dataD3 = [], torresEstatales = [];
let filteredD1 = [], filteredD2 = [], filteredD3 = [];
let map = null, mapLayerGroup = null;
let chartDependencia, chartBackhaul, chartProveedores, chartDistribucion, chartSectores, chartMunicipios;

const mapFilters = {
    showTowers: false,
    showDirect: true,
    showObstructed: true,
    showInstitutions: false,
    showProposedTowers: false
};

// Paginación
const ITEMS_PER_PAGE = 15;
let currentPageD1 = 1;
let currentPageD2 = 1;
let currentPageD3 = 1;

// Configuración Chart.js (Colores Institucionales)
const colors = {
    primary: '#8A004F',
    primaryDark: '#4B0028',
    accent: '#CC6C22',
    gold: '#D6B35F',
    success: '#0F766E',
    danger: '#B91C1C',
    surface: '#F9F6F4',
    border: '#E5E7EB',
    text: '#1F2937'
};

Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";
Chart.defaults.color = '#5A5A6E';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.plugins.tooltip.backgroundColor = '#1A1A2E';
Chart.defaults.plugins.tooltip.titleFont = { family: "'Outfit', sans-serif", weight: '700', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'Inter', sans-serif", size: 12 };
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 10;

// ═══════════════════════════════════════════════
// Animación CountUp para KPIs
// ═══════════════════════════════════════════════
function animateCountUp(element, targetValue, suffix = '', duration = 900) {
    const isFloat = String(targetValue).includes('.');
    const start = 0;
    const end = parseFloat(targetValue);
    if (isNaN(end)) { element.textContent = targetValue; return; }
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = start + (end - start) * eased;
        element.textContent = isFloat ? current.toFixed(isFloat ? (String(targetValue).split('.')[1] || '').length : 0) : Math.round(current).toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════
// Inicialización
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Intentar cargar todos los datasets
    Promise.all([
        loadCSV('data/torres_propuestas_actualizado.csv'),
        loadCSV('data/migraciones_posibles.csv'),
        loadCSV('data/Dataset_Instituciones_Unificadas.csv'),
        fetch('data/INFORMACION TORRES.txt').then(r => r.json()).catch(e => { console.warn("No se pudo cargar torres", e); return []; })
    ]).then(([d1, d2, d3, torres]) => {
        
        // Función para limpiar caracteres corruptos  (U+FFFD)
        const sanitize = (val) => {
            if (typeof val !== 'string') return val;
            if (!val.includes('\uFFFD')) return val;
            return val
                .replace(/NI\uFFFDoS/g, 'NIÑOS')
                .replace(/Ni\uFFFDos/g, 'Niños')
                .replace(/ni\uFFFDos/g, 'niños')
                .replace(/ACU\uFFFDA/g, 'ACUÑA')
                .replace(/Acu\uFFFDA/g, 'Acuña')
                .replace(/([A-Z])([A-Z])/g, '$1Ñ$2')
                .replace(/([a-z])([a-z])/g, '$1ñ$2')
                .replace(/\uFFFD/g, 'ñ');
        };

        const cleanRow = (row) => {
            for (let k in row) row[k] = sanitize(row[k]);
            return row;
        };

        dataD1 = d1.data.filter(row => row.nombre || row.grupo).map(cleanRow); // Limpiar vacíos
        dataD2 = d2.data.filter(row => row.id_institucion || row.institucion).map(cleanRow);
        dataD3 = d3.data.filter(row => row.id || row.nombre).map(cleanRow);
        torresEstatales = torres || [];
        
        // Enriquecer D1 con municipio desde D3
        dataD1.forEach(row1 => {
            const match = dataD3.find(row3 => 
                (row3.nombre && row1.nombre && String(row3.nombre).trim().toUpperCase() === String(row1.nombre).trim().toUpperCase()) ||
                (row3.latitud === row1.latitud && row3.longitud === row1.longitud)
            );
            if(match && match.municipio) {
                row1.municipio = match.municipio;
            } else {
                row1.municipio = 'Desconocido';
            }
        });

        // Enriquecer D2 con municipio desde D3
        dataD2.forEach(row2 => {
            const match = dataD3.find(row3 => String(row3.id) === String(row2.id_institucion));
            if(match) {
                row2.municipio = match.municipio;
            } else {
                row2.municipio = 'Desconocido';
            }
        });

        filteredD1 = [...dataD1];
        filteredD2 = [...dataD2];
        filteredD3 = [...dataD3];

        inicializarDashboard();
        
        // Ocultar spinner
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        // Renderizado retrasado del mapa
        setTimeout(() => {
            if(map) map.invalidateSize();
        }, 300);
    }).catch(error => {
        console.error("Error al cargar los CSV:", error);
        alert("Ocurrió un error al cargar los datos. Asegúrate de ejecutar esto desde un servidor local.");
        document.getElementById('loadingOverlay').classList.add('hidden');
    });
});

/**
 * Función auxiliar para leer y parsear archivos CSV usando la librería PapaParse.
 * Esta función es asíncrona (retorna una Promesa) para garantizar que los datos estén
 * listos antes de que el Dashboard intente renderizarlos.
 * 
 * @param {string} url - Ruta relativa al archivo CSV (ej. 'data/archivo.csv')
 * @returns {Promise<Object>} Promesa que resuelve con los resultados del parseo
 */
function loadCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            transformHeader: function(h) { return h.toLowerCase().trim(); },
            complete: function(results) {
                resolve(results);
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

// ═══════════════════════════════════════════════
// Configuración de UI
// ═══════════════════════════════════════════════
// Funciones Globales Auxiliares
// ═══════════════════════════════════════════════
/**
 * Normaliza textos eliminando acentos, espacios en blanco extra y convirtiendo todo a mayúsculas.
 * Esto es crucial para los filtros de búsqueda, ya que permite que "Hermosillo" coincida con "HERMOSILLO".
 * 
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto limpio y en mayúsculas
 */
function normalizeText(text) {
    if (!text || String(text).toUpperCase() === 'UNDEFINED') return '';
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

/**
 * Alterna la visibilidad de las pestañas principales del Dashboard (Propuesta, Migración, Padrón).
 * Además, fuerza un evento de redimensionamiento (`resize`) para evitar que el mapa de Leaflet
 * o las gráficas de Chart.js se rendericen cortadas al mostrarse por primera vez.
 * 
 * @param {string} tabId - ID del contenedor de la pestaña que se desea mostrar (ej. 'dataset1')
 */
function switchTab(tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));
    
    if(tabId === 'dataset1') document.getElementById('btn-tab-1').classList.add('active');
    else if(tabId === 'dataset2') document.getElementById('btn-tab-2').classList.add('active');
    else document.getElementById('btn-tab-3').classList.add('active');

    window.dispatchEvent(new Event('resize'));
    
    if(tabId === 'dataset1' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// ═══════════════════════════════════════════════
// Renderizado Principal
// ═══════════════════════════════════════════════
/**
 * Función principal que orquesta el renderizado inicial de todo el Dashboard una vez
 * que los datos CSV han sido cargados exitosamente.
 */
function inicializarDashboard() {
    initFilters();
    applyAllFilters();
}

/**
 * Extrae valores únicos de los datasets para llenar dinámicamente las listas
 * desplegables (<select>) de los filtros de la interfaz (Municipios, Sectores, Dependencias).
 */
function initFilters() {
    // D1
    const dependencias = [...new Set(dataD1.map(item => normalizeText(item.dependencia_torre_estatal)).filter(Boolean))].sort();
    const selectDep = document.getElementById('d1-filter-dependencia');
    dependencias.forEach(dep => selectDep.appendChild(new Option(dep, dep)));

    // D2
    const proveedores = [...new Set(dataD2.map(item => normalizeText(item.proveedor)).filter(Boolean))].sort();
    const selectProv = document.getElementById('d2-filter-prov');
    proveedores.forEach(prov => selectProv.appendChild(new Option(prov, prov)));

    // D3 y compartidos
    const municipios = [...new Set(dataD3.map(item => normalizeText(item.municipio)).filter(Boolean))].sort();
    const selectMun3 = document.getElementById('d3-filter-mun');
    const selectMun1 = document.getElementById('d1-filter-mun');
    const selectMun2 = document.getElementById('d2-filter-mun');
    
    municipios.forEach(mun => {
        if(selectMun3) selectMun3.appendChild(new Option(mun, mun));
        if(selectMun1) selectMun1.appendChild(new Option(mun, mun));
        if(selectMun2) selectMun2.appendChild(new Option(mun, mun));
    });

    const sectores = [...new Set(dataD3.map(item => normalizeText(item.grupo_institucion)).filter(Boolean))].sort();
    const selectSec = document.getElementById('d3-filter-sec');
    sectores.forEach(sec => selectSec.appendChild(new Option(sec, sec)));
}

/**
 * Calcula las métricas clave (KPIs) mostradas en la parte superior de cada pestaña,
 * sumando o promediando los datos del arreglo filtrado actual (filteredD1, filteredD2, etc.).
 */
function calcularKPIs() {
    // --- D1 ---
    animateCountUp(document.getElementById('d1-kpi-torres'), filteredD1.length);
    const sitiosBen = filteredD1.reduce((sum, row) => sum + (Number(row.cantidad_instituciones) || 0), 0);
    animateCountUp(document.getElementById('d1-kpi-sitios'), sitiosBen);
    const sumDist = filteredD1.reduce((sum, row) => sum + (Number(row.dist_km_torre_estatal_mas_cercana) || 0), 0);
    const avgDist = filteredD1.length > 0 ? (sumDist / filteredD1.length).toFixed(2) : '0';
    animateCountUp(document.getElementById('d1-kpi-dist'), avgDist);
    const vistas = filteredD1.filter(row => row.linea_vista === true || String(row.linea_vista).toLowerCase() === 'true').length;
    const vistasPct = filteredD1.length > 0 ? ((vistas / filteredD1.length) * 100).toFixed(1) : '0';
    animateCountUp(document.getElementById('d1-kpi-vista'), vistasPct);

    // --- D2 ---
    animateCountUp(document.getElementById('d2-kpi-inst'), filteredD2.length);
    const sumProx = filteredD2.reduce((sum, row) => sum + (Number(row.dist_km) || 0), 0);
    const avgProx = filteredD2.length > 0 ? (sumProx / filteredD2.length).toFixed(2) : '0';
    animateCountUp(document.getElementById('d2-kpi-prox'), avgProx);
    animateCountUp(document.getElementById('d2-kpi-prov'), new Set(filteredD2.map(row => String(row.proveedor).toUpperCase()).filter(p => p && p !== 'UNDEFINED')).size);

    // --- D3 ---
    animateCountUp(document.getElementById('d3-kpi-total'), filteredD3.length);
    
    let n1 = 0, n2 = 0, n3 = 0;
    filteredD3.forEach(row => {
        const ipc = String(row.ipc || '').toLowerCase();
        if(ipc.includes('nivel 1')) n1++;
        else if(ipc.includes('nivel 2')) n2++;
        else if(ipc.includes('nivel 3')) n3++;
    });

    const total = filteredD3.length || 1;
    animateCountUp(document.getElementById('d3-kpi-n1'), ((n1 / total) * 100).toFixed(1));
    animateCountUp(document.getElementById('d3-kpi-n2'), ((n2 / total) * 100).toFixed(1));
    animateCountUp(document.getElementById('d3-kpi-n3'), ((n3 / total) * 100).toFixed(1));
}

// ═══════════════════════════════════════════════
// Leaflet Map
// ═══════════════════════════════════════════════
/**
 * Inicializa y dibuja el mapa interactivo usando la librería Leaflet.
 * Renderiza los clústeres (como círculos) y las torres (como marcadores/estrellas),
 * y configura la leyenda flotante con los checkboxes para ocultar o mostrar capas.
 */
function renderMap() {
    // Inicializar Mapa solo una vez
    if (!map) {
        map = L.map('map-torres', {zoomControl: false}).setView([29.2972, -110.3309], 6);
        L.control.zoom({position: 'topleft'}).addTo(map);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        // Control de leyenda y filtros del mapa
        const legend = L.control({position: 'topright'});
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'map-legend');
            
            div.innerHTML = `
                <h4>Filtros del Mapa</h4>
                <label>
                    <input type="checkbox" id="filter-towers">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #4B0028; margin-right: 6px;"></span>
                    Torres Estatales
                </label>
                <label>
                    <input type="checkbox" id="filter-proposed-towers">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-right: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#D6B35F" stroke="#7D0042" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#FFF"></circle></svg>
                    </span>
                    Torres Propuestas
                </label>
                <label>
                    <input type="checkbox" checked id="filter-direct">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: rgba(204, 108, 34, 0.9); border: 2px solid #CC6C22; margin-right: 6px;"></span>
                    Clústeres (Línea de Vista)
                </label>
                <label>
                    <input type="checkbox" checked id="filter-obstructed">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: rgba(138, 0, 79, 0.9); border: 2px solid #8A004F; margin-right: 6px;"></span>
                    Clústeres (Obstruidos)
                </label>
                <label>
                    <input type="checkbox" id="filter-institutions">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #0F766E; margin-right: 6px;"></span>
                    Instituciones
                </label>
            `;
            
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            return div;
        };
        legend.addTo(map);

        document.getElementById('filter-towers').addEventListener('change', (e) => {
            mapFilters.showTowers = e.target.checked;
            renderMap();
        });
        document.getElementById('filter-proposed-towers').addEventListener('change', (e) => {
            mapFilters.showProposedTowers = e.target.checked;
            renderMap();
        });
        document.getElementById('filter-direct').addEventListener('change', (e) => {
            mapFilters.showDirect = e.target.checked;
            renderMap();
        });
        document.getElementById('filter-obstructed').addEventListener('change', (e) => {
            mapFilters.showObstructed = e.target.checked;
            renderMap();
        });
        document.getElementById('filter-institutions').addEventListener('change', (e) => {
            mapFilters.showInstitutions = e.target.checked;
            renderMap();
        });
    }

    if (mapLayerGroup) { mapLayerGroup.clearLayers(); }
    else { mapLayerGroup = L.layerGroup().addTo(map); }

    const bounds = [];

    // 1. Dibujar Torres Estatales Reales (Círculos Oscuros)
    if (mapFilters.showTowers) {
        torresEstatales.forEach(item => {
        const feature = item.geojson;
        if (!feature || !feature.geometry) return;
        
        const coords = feature.geometry.coordinates;
        if(coords && coords.length === 2) {
            const lat = coords[1];
            const lon = coords[0];
            const props = feature.properties;
            
            const marker = L.circleMarker([lat, lon], {
                radius: 6,
                fillColor: colors.primaryDark,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(mapLayerGroup);
            
            bounds.push([lat, lon]);
            
            marker.bindPopup(`
                <div class="popup-title">📡 Torre Estatal: ${props.nombre}</div>
                <div class="popup-row"><span class="popup-label">Dependencia</span><span class="popup-value">${props["dependencia administradora"]}</span></div>
                <div class="popup-row"><span class="popup-label">Municipio</span><span class="popup-value">${props.municipio}</span></div>
                <div class="popup-row"><span class="popup-label">Estatus</span><span class="popup-value">${props.estatus}</span></div>
            `);
        }
    });
    }

    // 2. Dibujar Clústeres Propuestos (Círculos Naranjas/Vino)
    filteredD1.forEach(row => {
        const lat = parseFloat(row.latitud);
        const lon = parseFloat(row.longitud);

        if (!isNaN(lat) && !isNaN(lon)) {
            const isDirecta = row.linea_vista === true || String(row.linea_vista).toLowerCase() === 'true';
            
            if (isDirecta && !mapFilters.showDirect) return;
            if (!isDirecta && !mapFilters.showObstructed) return;

            const markerColor = isDirecta ? colors.accent : colors.primary;
            const size = Math.max(8, Math.min(24, (row.cantidad_instituciones || 1) * 2));

            const circleMarker = L.circleMarker([lat, lon], {
                radius: size,
                fillColor: markerColor,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(mapLayerGroup);

            bounds.push([lat, lon]);

            circleMarker.bindPopup(`
                <div class="popup-title">🏫 Clúster: ${row.nombre || 'Sin nombre'}</div>
                <div class="popup-row"><span class="popup-label">Conexión Backhaul</span><span class="popup-value" style="color: ${markerColor}">${row.conexion_backhaul || (isDirecta ? 'Directa' : 'Obstruida')}</span></div>
                <div class="popup-row"><span class="popup-label">Instituciones</span><span class="popup-value">${row.cantidad_instituciones || 1}</span></div>
                <div class="popup-row"><span class="popup-label">Torre Interconexión</span><span class="popup-value">${row.torre_estatal_cercana || 'N/A'}</span></div>
            `);
        }
    });

    // 3. Dibujar Instituciones Individuales
    if (mapFilters.showInstitutions) {
        filteredD3.forEach(row => {
            const lat = parseFloat(row.latitud || row.LATITUD);
            const lon = parseFloat(row.longitud || row.LONGITUD);
            if (!isNaN(lat) && !isNaN(lon)) {
                bounds.push([lat, lon]);
                const marker = L.circleMarker([lat, lon], {
                    radius: 3,
                    fillColor: '#0F766E', // Success Teal
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.95
                }).addTo(mapLayerGroup);
                
                marker.bindPopup(`
                    <div class="popup-title">🏫 Institución: ${row.nombre || row.NOMBRE || 'Sin nombre'}</div>
                    <div class="popup-row"><span class="popup-label">Sector</span><span class="popup-value">${row.grupo_institucion || 'N/A'}</span></div>
                    <div class="popup-row"><span class="popup-label">Municipio</span><span class="popup-value">${row.municipio || row.MUNICIPIO || 'N/A'}</span></div>
                    <div class="popup-row"><span class="popup-label">Conexión</span><span class="popup-value" style="color: #0F766E;">${row.estatus_conexion || 'A evaluar'}</span></div>
                `);
            }
        });
    }

    // 4. Dibujar Torres Propuestas (Estrellitas SVG)
    if (mapFilters.showProposedTowers) {
        const starIcon = L.divIcon({
            html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#D6B35F" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.5)); margin-top: -12px; margin-left: -6px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#7D0042"></circle></svg>',
            className: 'custom-star-icon',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        filteredD1.forEach(row => {
            const lat = parseFloat(row.latitud);
            const lon = parseFloat(row.longitud);

            if (!isNaN(lat) && !isNaN(lon)) {
                L.marker([lat, lon], {icon: starIcon, zIndexOffset: 500}).addTo(mapLayerGroup)
                    .bindPopup(`
                        <div class="popup-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#D6B35F" stroke="#7D0042" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="#FFF"></circle></svg>
                            Torre Propuesta
                        </div>
                        <div class="popup-row"><span class="popup-label">Clúster</span><span class="popup-value">${row.nombre || 'Sin nombre'}</span></div>
                        <div class="popup-row"><span class="popup-label">Inst. a Conectar</span><span class="popup-value">${row.cantidad_instituciones || 1}</span></div>
                    `);
            }
        });
    }

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// ═══════════════════════════════════════════════
// Chart.js Gráficas
// ═══════════════════════════════════════════════
/**
 * Crea e inicializa todas las gráficas estadísticas utilizando la librería Chart.js.
 * Extrae y agrupa los datos de las tablas filtradas para presentarlos de forma visual.
 */
function renderCharts() {
    // Colores para usar en gráficas
    const palette = [colors.primary, colors.accent, colors.gold, colors.success, colors.danger, '#6B21A8', '#0369A1', '#B45309'];

    // Gradiente robusto que no falla en carga inicial
    const safeGradient = (colorHex, isHoriz) => (context) => {
        if (context.type !== 'data' || !colorHex) return colorHex;
        const {ctx, chartArea} = context.chart;
        if (!chartArea) return colorHex;

        let r = parseInt(colorHex.slice(1, 3), 16), g = parseInt(colorHex.slice(3, 5), 16), b = parseInt(colorHex.slice(5, 7), 16);
        
        try {
            let grad = isHoriz ? ctx.createLinearGradient(chartArea.left || 0, 0, chartArea.right || 0, 0) 
                               : ctx.createLinearGradient(0, chartArea.bottom || 0, 0, chartArea.top || 0);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.95)`);
            return grad;
        } catch (e) {
            // Fallback if canvas is not ready or coordinates are invalid
            return colorHex;
        }
    };

    const getArrayGradient = (colorsArr, isHoriz) => (context) => {
        if (context.type !== 'data' || context.dataIndex === undefined) return colorsArr[0];
        const color = colorsArr[context.dataIndex % colorsArr.length];
        return safeGradient(color, isHoriz)(context);
    };

    // --- D1: Dependencia ---
    const depsCount = {};
    const vistaCount = { 'Directa': 0, 'Sugerir repetidor': 0 };

    filteredD1.forEach(row => {
        const dep = row.dependencia_torre_estatal || 'Desconocido';
        depsCount[dep] = (depsCount[dep] || 0) + 1;
        const isDirecta = row.linea_vista === true || String(row.linea_vista).toLowerCase() === 'true';
        if (isDirecta) vistaCount['Directa']++;
        else vistaCount['Sugerir repetidor']++;
    });

    if (chartDependencia) chartDependencia.destroy();
    chartDependencia = new Chart(document.getElementById('chart-dependencia'), {
        type: 'bar',
        data: {
            labels: Object.keys(depsCount),
            datasets: [{
                label: 'Clústeres',
                data: Object.values(depsCount),
                backgroundColor: getArrayGradient(Object.keys(depsCount).map((_, i) => palette[i % palette.length]), false),
                borderColor: Object.keys(depsCount).map((_, i) => palette[i % palette.length]),
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 60
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });

    // --- D1: Backhaul ---
    if (chartBackhaul) chartBackhaul.destroy();
    chartBackhaul = new Chart(document.getElementById('chart-backhaul'), {
        type: 'bar',
        data: {
            labels: ['Línea Vista Directa', 'Obstruida / Repetidor'],
            datasets: [{
                label: 'Clústeres Propuestos',
                data: [vistaCount['Directa'], vistaCount['Sugerir repetidor']],
                backgroundColor: getArrayGradient([colors.success, colors.danger], true),
                borderColor: [colors.success, colors.danger],
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 60
            }]
        },
        options: {
            indexAxis: 'y', // Barras horizontales
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true }, y: { grid: { display: false } } }
        }
    });

    // --- D2: Proveedores e Histograma ---
    const provCount = {};
    const distBins = Array(20).fill(0);
    let maxDist = 0;

    filteredD2.forEach(row => {
        const prov = String(row.proveedor || 'No Definido').toUpperCase();
        provCount[prov] = (provCount[prov] || 0) + 1;
        const d = Number(row.dist_km) || 0;
        if (d > maxDist) maxDist = d;
    });

    const topProv = Object.entries(provCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (chartProveedores) chartProveedores.destroy();
    chartProveedores = new Chart(document.getElementById('chart-proveedores'), {
        type: 'bar',
        data: {
            labels: topProv.map(item => item[0]),
            datasets: [{ 
                label: 'Enlaces', 
                data: topProv.map(item => item[1]), 
                backgroundColor: getArrayGradient(topProv.map((_, i) => palette[i % palette.length]), true),
                borderColor: topProv.map((_, i) => palette[i % palette.length]),
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 60
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true }, y: { grid: { display: false } } }
        }
    });

    const binSize = maxDist > 0 ? maxDist / 20 : 1;
    filteredD2.forEach(row => {
        const d = Number(row.dist_km) || 0;
        let binIndex = Math.floor(d / binSize);
        if (binIndex >= 20) binIndex = 19;
        distBins[binIndex]++;
    });

    if (chartDistribucion) chartDistribucion.destroy();
    chartDistribucion = new Chart(document.getElementById('chart-distribucion'), {
        type: 'bar',
        data: {
            labels: Array(20).fill(0).map((_, i) => `${(i * binSize).toFixed(1)} - ${((i+1) * binSize).toFixed(1)}`),
            datasets: [{ 
                label: 'Instituciones', 
                data: distBins, 
                backgroundColor: safeGradient(colors.accent, false),
                borderColor: colors.accent,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 60,
                barPercentage: 0.9, 
                categoryPercentage: 1.0 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } }
        }
    });

    // --- D3: Padrón General ---
    const secCount = { 'Nivel 1': {}, 'Nivel 2': {}, 'Nivel 3': {} };
    const munCount = {};

    filteredD3.forEach(row => {
        const sec = String(row.grupo_institucion || 'Sin Sector').toUpperCase();
        const mun = String(row.municipio || 'Desconocido');
        const ipc = String(row.ipc || '').toLowerCase();
        
        let nivelKey = null;
        if(ipc.includes('nivel 1')) nivelKey = 'Nivel 1';
        else if(ipc.includes('nivel 2')) nivelKey = 'Nivel 2';
        else if(ipc.includes('nivel 3')) nivelKey = 'Nivel 3';
        
        if(nivelKey) {
            secCount[nivelKey][sec] = (secCount[nivelKey][sec] || 0) + 1;
        }
        
        munCount[mun] = (munCount[mun] || 0) + 1;
    });

    const sectoresUnicos = [...new Set(filteredD3.map(r => String(r.grupo_institucion || 'Sin Sector').toUpperCase()))];
    
    if (chartSectores) chartSectores.destroy();
    chartSectores = new Chart(document.getElementById('chart-sectores'), {
        type: 'bar',
        data: {
            labels: sectoresUnicos,
            datasets: [
                { 
                    label: 'Nivel 1 (Red Estatal)', 
                    data: sectoresUnicos.map(s => secCount['Nivel 1'][s] || 0), 
                    backgroundColor: safeGradient(colors.success, false),
                    borderColor: colors.success,
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 60
                },
                { 
                    label: 'Nivel 2 (Pagan Privado)', 
                    data: sectoresUnicos.map(s => secCount['Nivel 2'][s] || 0), 
                    backgroundColor: safeGradient(colors.gold, false),
                    borderColor: colors.gold,
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 60
                },
                { 
                    label: 'Nivel 3 (Desconectados)', 
                    data: sectoresUnicos.map(s => secCount['Nivel 3'][s] || 0), 
                    backgroundColor: safeGradient(colors.danger, false),
                    borderColor: colors.danger,
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 60
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    const topMun = Object.entries(munCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (chartMunicipios) chartMunicipios.destroy();
    chartMunicipios = new Chart(document.getElementById('chart-municipios'), {
        type: 'bar',
        data: {
            labels: topMun.map(m => m[0]),
            datasets: [{ 
                label: 'Instituciones', 
                data: topMun.map(m => m[1]), 
                backgroundColor: getArrayGradient(topMun.map((_, i) => palette[i % palette.length]), true),
                borderColor: topMun.map((_, i) => palette[i % palette.length]),
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false,
                maxBarThickness: 60
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } }
        }
    });
}

// ═══════════════════════════════════════════════
// Tablas
// ═══════════════════════════════════════════════
/**
 * Renderiza y actualiza la tabla de la Pestaña 1 (Propuesta de Infraestructura).
 * Se encarga de capturar los valores actuales de los filtros, filtrar la data (dataD1 -> filteredD1),
 * aplicar el ordenamiento, realizar la paginación y finalmente construir el HTML de las filas.
 */
function renderTableD1() {
    const tbody = document.getElementById('tbody-d1');
    const emptyState = document.getElementById('empty-d1');
    tbody.innerHTML = '';
    
    if (filteredD1.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('info-d1').textContent = `Mostrando 0 registros`;
        document.getElementById('pagination-d1').innerHTML = '';
        return;
    }
    emptyState.style.display = 'none';

    const totalPages = Math.ceil(filteredD1.length / ITEMS_PER_PAGE);
    if (currentPageD1 > totalPages) currentPageD1 = totalPages;
    if (currentPageD1 < 1) currentPageD1 = 1;
    const startIdx = (currentPageD1 - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, filteredD1.length);
    const pageData = filteredD1.slice(startIdx, endIdx);

    pageData.forEach(row => {
        const isDirecta = row.linea_vista === true || String(row.linea_vista).toLowerCase() === 'true';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:var(--color-primary-dark)">${(row.grupo || '').toUpperCase()}</strong></td>
            <td>${row.nombre || ''}</td>
            <td>${Number(row.dist_km_torre_estatal_mas_cercana || 0).toFixed(2)}</td>
            <td>${parseInt(row.cantidad_instituciones || 0)}</td>
            <td>${row.torre_estatal_cercana || ''} <span style="opacity:0.6">(${row.dependencia_torre_estatal || ''})</span></td>
            <td><span class="badge ${isDirecta ? 'badge-success' : 'badge-danger'}">${isDirecta ? 'Directa' : 'Obstruida'}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('info-d1').textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${filteredD1.length} registros`;
    renderPagination('pagination-d1', totalPages, currentPageD1, (page) => { currentPageD1 = page; renderTableD1(); });
}

/**
 * Renderiza y actualiza la tabla de la Pestaña 2 (Plan de Migración).
 * Aplica los filtros de Municipio y Proveedor, además de la búsqueda general.
 */
function renderTableD2() {
    const tbody = document.getElementById('tbody-d2');
    const emptyState = document.getElementById('empty-d2');
    tbody.innerHTML = '';
    
    if (filteredD2.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('info-d2').textContent = `Mostrando 0 registros`;
        document.getElementById('pagination-d2').innerHTML = '';
        return;
    }
    emptyState.style.display = 'none';

    const totalPages = Math.ceil(filteredD2.length / ITEMS_PER_PAGE);
    if (currentPageD2 > totalPages) currentPageD2 = totalPages;
    if (currentPageD2 < 1) currentPageD2 = 1;
    const startIdx = (currentPageD2 - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, filteredD2.length);
    const pageData = filteredD2.slice(startIdx, endIdx);

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--color-muted); font-size:11px;">${row.id_institucion || ''}</td>
            <td style="font-weight:500;">${row.institucion || ''}</td>
            <td>${row.municipio || ''}</td>
            <td><span class="badge badge-info">${String(row.proveedor || '').toUpperCase()}</span></td>
            <td>${row.torre_cercana || ''}</td>
            <td><strong style="color:var(--color-accent)">${Number(row.dist_km || 0).toFixed(2)}</strong></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('info-d2').textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${filteredD2.length} registros`;
    renderPagination('pagination-d2', totalPages, currentPageD2, (page) => { currentPageD2 = page; renderTableD2(); });
}

/**
 * Renderiza y actualiza la tabla de la Pestaña 3 (Padrón General).
 * Aplica filtros por Municipio y Sector, además de la búsqueda por texto.
 */
function renderTableD3() {
    const tbody = document.getElementById('tbody-d3');
    const emptyState = document.getElementById('empty-d3');
    tbody.innerHTML = '';
    
    if (filteredD3.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('info-d3').textContent = `Mostrando 0 registros`;
        document.getElementById('pagination-d3').innerHTML = '';
        return;
    }
    emptyState.style.display = 'none';

    const totalPages = Math.ceil(filteredD3.length / ITEMS_PER_PAGE);
    if (currentPageD3 > totalPages) currentPageD3 = totalPages;
    if (currentPageD3 < 1) currentPageD3 = 1;
    const startIdx = (currentPageD3 - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, filteredD3.length);
    const pageData = filteredD3.slice(startIdx, endIdx);

    pageData.forEach(row => {
        const ipc = String(row.ipc || '').toLowerCase();
        let badgeClass = 'badge-info';
        if(ipc.includes('nivel 1')) badgeClass = 'badge-success';
        else if(ipc.includes('nivel 2')) badgeClass = 'badge-accent';
        else if(ipc.includes('nivel 3')) badgeClass = 'badge-danger';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--color-muted); font-size:11px;">${row.id || ''}</td>
            <td style="font-weight:500;">${row.nombre || ''}</td>
            <td>${row.municipio || ''}</td>
            <td>${String(row.grupo_institucion || '').toUpperCase()}</td>
            <td><span class="badge ${badgeClass}">${row.ipc || ''}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('info-d3').textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${filteredD3.length} registros`;
    renderPagination('pagination-d3', totalPages, currentPageD3, (page) => { currentPageD3 = page; renderTableD3(); });
}

function renderPagination(containerId, totalPages, current, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn'; btnPrev.textContent = '«'; btnPrev.disabled = current === 1;
    if(!btnPrev.disabled) btnPrev.onclick = () => callback(current - 1);
    container.appendChild(btnPrev);

    let startPage = Math.max(1, current - 2);
    let endPage = Math.min(totalPages, current + 2);

    if (startPage > 1) {
        const btnFirst = document.createElement('button'); btnFirst.className = 'page-btn'; btnFirst.textContent = '1'; btnFirst.onclick = () => callback(1);
        container.appendChild(btnFirst);
        if (startPage > 2) { const dots = document.createElement('span'); dots.textContent = '...'; dots.style.alignSelf = 'flex-end'; dots.style.margin = '0 2px'; container.appendChild(dots); }
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button'); btn.className = `page-btn ${i === current ? 'active' : ''}`; btn.textContent = i; btn.onclick = () => callback(i);
        container.appendChild(btn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) { const dots = document.createElement('span'); dots.textContent = '...'; dots.style.alignSelf = 'flex-end'; dots.style.margin = '0 2px'; container.appendChild(dots); }
        const btnLast = document.createElement('button'); btnLast.className = 'page-btn'; btnLast.textContent = totalPages; btnLast.onclick = () => callback(totalPages);
        container.appendChild(btnLast);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn'; btnNext.textContent = '»'; btnNext.disabled = current === totalPages;
    if(!btnNext.disabled) btnNext.onclick = () => callback(current + 1);
    container.appendChild(btnNext);
}

// ═══════════════════════════════════════════════
// Filtrado y Búsqueda
// ═══════════════════════════════════════════════
function handleSearch() { applyAllFilters(); }

function applyAllFilters() {
    const searchEl = document.getElementById('global-search');
    const q = searchEl ? searchEl.value.toLowerCase() : '';
    // Filtros D1
    const vVista = document.getElementById('d1-filter-vista').value;
    const vDep = document.getElementById('d1-filter-dependencia').value;
    const vMun1 = document.getElementById('d1-filter-mun') ? document.getElementById('d1-filter-mun').value : 'all';

    filteredD1 = dataD1.filter(row => {
        let matchText = !q || `${row.nombre} ${row.grupo} ${row.torre_estatal_cercana}`.toLowerCase().includes(q);
        let matchVista = vVista === 'all' || ((row.linea_vista === true || String(row.linea_vista).toLowerCase() === 'true' ? 'Directa' : 'Sugerir repetidor') === vVista);
        let matchDep = vDep === 'all' || normalizeText(row.dependencia_torre_estatal) === vDep;
        let matchMun = vMun1 === 'all' || normalizeText(row.municipio) === vMun1;
        return matchText && matchVista && matchDep && matchMun;
    });

    // Filtros D2
    const vProv = document.getElementById('d2-filter-prov').value;
    const vMun2 = document.getElementById('d2-filter-mun') ? document.getElementById('d2-filter-mun').value : 'all';

    filteredD2 = dataD2.filter(row => {
        let matchText = !q || `${row.institucion} ${row.torre_cercana} ${row.municipio}`.toLowerCase().includes(q);
        let matchProv = vProv === 'all' || normalizeText(row.proveedor) === vProv;
        let matchMun = vMun2 === 'all' || normalizeText(row.municipio) === vMun2;
        return matchText && matchProv && matchMun;
    });

    // Filtros D3
    const vMun = document.getElementById('d3-filter-mun').value;
    const vSec = document.getElementById('d3-filter-sec').value;
    const vIpc = document.getElementById('d3-filter-ipc').value;

    filteredD3 = dataD3.filter(row => {
        let matchText = !q || `${row.nombre} ${row.municipio} ${row.grupo_institucion}`.toLowerCase().includes(q);
        let matchMun = vMun === 'all' || normalizeText(row.municipio) === vMun;
        let matchSec = vSec === 'all' || normalizeText(row.grupo_institucion) === vSec;
        let matchIpc = vIpc === 'all' || String(row.ipc).toUpperCase().includes(String(vIpc).toUpperCase());
        return matchText && matchMun && matchSec && matchIpc;
    });

    currentPageD1 = 1; currentPageD2 = 1; currentPageD3 = 1;
    
    calcularKPIs(); renderMap(); renderCharts();
    
    // Aplicar ordenamiento actual y renderizar tablas
    sortAscD1 = !sortAscD1; sortTableD1(sortColD1 || 'dist');
    sortAscD2 = !sortAscD2; sortTableD2(sortColD2 || 'id');
    sortAscD3 = !sortAscD3; sortTableD3(sortColD3 || 'id');
}

document.getElementById('d1-filter-vista').addEventListener('change', applyAllFilters);
document.getElementById('d1-filter-dependencia').addEventListener('change', applyAllFilters);
if(document.getElementById('d1-filter-mun')) document.getElementById('d1-filter-mun').addEventListener('change', applyAllFilters);
document.getElementById('d2-filter-prov').addEventListener('change', applyAllFilters);
if(document.getElementById('d2-filter-mun')) document.getElementById('d2-filter-mun').addEventListener('change', applyAllFilters);
document.getElementById('d3-filter-mun').addEventListener('change', applyAllFilters);
document.getElementById('d3-filter-sec').addEventListener('change', applyAllFilters);
document.getElementById('d3-filter-ipc').addEventListener('change', applyAllFilters);

function resetFilters(dataset) {
    const searchEl = document.getElementById('global-search');
    if (searchEl) searchEl.value = '';
    if (dataset === 'd1' || dataset === 'all') { document.getElementById('d1-filter-vista').value = 'all'; document.getElementById('d1-filter-dependencia').value = 'all'; if(document.getElementById('d1-filter-mun')) document.getElementById('d1-filter-mun').value = 'all'; }
    if (dataset === 'd2' || dataset === 'all') { document.getElementById('d2-filter-prov').value = 'all'; if(document.getElementById('d2-filter-mun')) document.getElementById('d2-filter-mun').value = 'all'; }
    if (dataset === 'd3' || dataset === 'all') { document.getElementById('d3-filter-mun').value = 'all'; document.getElementById('d3-filter-sec').value = 'all'; document.getElementById('d3-filter-ipc').value = 'all'; }
    applyAllFilters();
}

// ═══════════════════════════════════════════════
// Ordenamiento de Tablas
// ═══════════════════════════════════════════════
function updateSortArrows(tableId, activeCol, isAsc) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const ths = table.querySelectorAll('th');
    ths.forEach(th => {
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) {
            const onclickText = th.getAttribute('onclick') || '';
            if (activeCol && onclickText.includes(`'${activeCol}'`)) {
                arrow.textContent = isAsc ? '▲' : '▼';
                arrow.style.opacity = '1';
                arrow.style.color = 'var(--color-primary)';
            } else {
                arrow.textContent = '▼';
                arrow.style.opacity = '0.3';
                arrow.style.color = 'inherit';
            }
        }
    });
}

let sortColD1 = 'dist', sortAscD1 = true;
function sortTableD1(col) {
    sortAscD1 = sortColD1 === col ? !sortAscD1 : true; sortColD1 = col;
    filteredD1.sort((a, b) => {
        let valA, valB;
        switch(col) {
            case 'grupo': valA = String(a.grupo||'').toLowerCase(); valB = String(b.grupo||'').toLowerCase(); break;
            case 'nombre': valA = String(a.nombre||'').toLowerCase(); valB = String(b.nombre||'').toLowerCase(); break;
            case 'dist': valA = Number(a.dist_km_torre_estatal_mas_cercana)||0; valB = Number(b.dist_km_torre_estatal_mas_cercana)||0; break;
            case 'inst': valA = Number(a.cantidad_instituciones)||0; valB = Number(b.cantidad_instituciones)||0; break;
            case 'torre': valA = String(a.torre_estatal_cercana||'').toLowerCase(); valB = String(b.torre_estatal_cercana||'').toLowerCase(); break;
            case 'vista': valA = a.linea_vista ? 1 : 0; valB = b.linea_vista ? 1 : 0; break;
        }
        if (valA < valB) return sortAscD1 ? -1 : 1; if (valA > valB) return sortAscD1 ? 1 : -1; return 0;
    });
    renderTableD1();
    updateSortArrows('table-d1', col, sortAscD1);
}

let sortColD2 = 'dist', sortAscD2 = true;
function sortTableD2(col) {
    sortAscD2 = sortColD2 === col ? !sortAscD2 : true; sortColD2 = col;
    filteredD2.sort((a, b) => {
        let valA, valB;
        switch(col) {
            case 'id': valA = Number(a.id_institucion)||0; valB = Number(b.id_institucion)||0; break;
            case 'institucion': valA = String(a.institucion||'').toLowerCase(); valB = String(b.institucion||'').toLowerCase(); break;
            case 'municipio': valA = String(a.municipio||'').toLowerCase(); valB = String(b.municipio||'').toLowerCase(); break;
            case 'proveedor': valA = String(a.proveedor||'').toLowerCase(); valB = String(b.proveedor||'').toLowerCase(); break;
            case 'torre': valA = String(a.torre_cercana||'').toLowerCase(); valB = String(b.torre_cercana||'').toLowerCase(); break;
            case 'dist': valA = Number(a.dist_km)||0; valB = Number(b.dist_km)||0; break;
        }
        if (valA < valB) return sortAscD2 ? -1 : 1; if (valA > valB) return sortAscD2 ? 1 : -1; return 0;
    });
    renderTableD2();
    updateSortArrows('table-d2', col, sortAscD2);
}

let sortColD3 = 'ipc', sortAscD3 = true;
function sortTableD3(col) {
    sortAscD3 = sortColD3 === col ? !sortAscD3 : true; sortColD3 = col;
    filteredD3.sort((a, b) => {
        let valA, valB;
        switch(col) {
            case 'id': valA = Number(a.id)||0; valB = Number(b.id)||0; break;
            case 'nombre': valA = String(a.nombre||'').toLowerCase(); valB = String(b.nombre||'').toLowerCase(); break;
            case 'municipio': valA = String(a.municipio||'').toLowerCase(); valB = String(b.municipio||'').toLowerCase(); break;
            case 'sector': valA = String(a.grupo_institucion||'').toLowerCase(); valB = String(b.grupo_institucion||'').toLowerCase(); break;
            case 'ipc': valA = String(a.ipc||'').toLowerCase(); valB = String(b.ipc||'').toLowerCase(); break;
        }
        if (valA < valB) return sortAscD3 ? -1 : 1; if (valA > valB) return sortAscD3 ? 1 : -1; return 0;
    });
    renderTableD3();
    updateSortArrows('table-d3', col, sortAscD3);
}
