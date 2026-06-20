# Dashboard de Infraestructura Pública de Telecomunicaciones del Estado de Sonora

Este proyecto presenta el Dashboard interactivo para la propuesta de infraestructura y plan de migración de telecomunicaciones del Estado de Sonora. Su propósito principal es optimizar el uso de la infraestructura pública para mejorar la conectividad de escuelas, hospitales y oficinas gubernamentales.

## Resumen del Proyecto

El análisis estratégico se enfocó en dos grandes objetivos:
1. **Plan de Migración:** Identificar instituciones que actualmente pagan a proveedores privados y que podrían migrarse a torres estatales cercanas.
2. **Propuesta de Expansión:** Identificar zonas prioritarias para nueva infraestructura (Clústeres), específicamente en lugares donde no existe conectividad ni una torre estatal cercana.

**Impacto y Resultados Clave:**
- 📊 **3,547** instituciones públicas analizadas (escuelas, gobierno, salud, seguridad).
- 💰 **1,608** candidatas a migración hacia infraestructura estatal, lo que representaría un ahorro anual estimado de **$25,084,800 MXN**.
- 📍 **47** zonas prioritarias detectadas para nueva infraestructura mediante el Índice de Prioridad de Conectividad (IPC).
- 📡 **34** torres propuestas con viabilidad comprobada (línea de vista directa), que beneficiarían a **286** instituciones actualmente desconectadas, reduciendo en un 30% la brecha de conectividad más crítica.

---

### Estructura del Proyecto

*   `index.html`: Archivo principal. Contiene la estructura y maquetado del dashboard.
*   `css/styles.css`: Sistema de diseño (variables de color institucionales, layout, utilidades y responsive design).
*   `js/app.js`: Lógica core de la aplicación. Carga los CSVs, aplica algoritmos de limpieza/unificación, calcula los KPIs, inicializa el mapa interactivo y renderiza las gráficas en tiempo real de acuerdo a los filtros.
*   `data/`: Carpeta con los archivos `.csv` de donde se leen los datos dinámicamente.

### Tecnologías Utilizadas

*   **[PapaParse](https://www.papaparse.com/)**: Para parsear los archivos CSV de forma local y asíncrona.
*   **[Chart.js](https://www.chartjs.org/)**: Para las visualizaciones de métricas y gráficas.
*   **[Leaflet](https://leafletjs.com/)**: Para la visualización interactiva del mapa, marcadores topográficos y filtros de capas.
*   **Google Fonts**: Implementación de la tipografía "Inter" para legibilidad moderna.

---

### Equipo de Análisis y Desarrollo

* Ana Sofía Matti Ríos
* Daniel Eduardo Alvarez Terrazas
* Jesus David Ayala Morales 
* Christian Alexis Flores Alvarez

