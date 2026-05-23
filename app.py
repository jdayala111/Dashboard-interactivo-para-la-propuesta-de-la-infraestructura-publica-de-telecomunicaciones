import streamlit as st
import pandas as pd
import plotly.express as px
from src.data_loader import load_csv_data

# Configuración de la pagina
st.set_page_config(
    page_title="Dashboard de Conectividad - Sonora",
    page_icon="",
    layout="wide"
)

st.markdown("""
    <style>
    .main-title { font-size: 32px; font-weight: bold; color: #1E3A8A; margin-bottom: 5px; }
    .subtitle { font-size: 16px; color: #4B5563; margin-bottom: 25px; }
    </style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title"> Dashboard de Infraestructura y Línea de Vista</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Análisis analítico de conectividad para instituciones y torres propuestas</div>', unsafe_allow_html=True)

# Carga de datos
DATA_PATH = "data/torres propuestas con linea de vista agregada con minimo 3 en cluster.csv"
df = load_csv_data(DATA_PATH)

if not df.empty:
    if 'score' in df.columns:
        df['score'] = df['score'].round(2)
    
    st.sidebar.header("Filtros de Búsqueda")
    df_filtrado = df.copy()
    
    # Filtros
    if 'grupo_institucion' in df.columns:
        opciones_grupo = sorted(list(df['grupo_institucion'].unique()))
        seleccion_grupo = st.sidebar.multiselect(
            "Grupo de Institución:",
            options=opciones_grupo,
            default=opciones_grupo
        )
        df_filtrado = df_filtrado[df_filtrado['grupo_institucion'].isin(seleccion_grupo)]
    
    # Tarjetas métricas
    if not df_filtrado.empty:
        met1, met2, met3, met4 = st.columns(4)
        
        with met1:
            total_puntos = len(df_filtrado)
            st.metric(label="Instituciones Filtradas", value=total_puntos)
        
        with met2:
            dist_promedio = df_filtrado['distancia_torre_estatal_cercana'].mean()
            st.metric(label="Distancia Promedio a Torre", value=f"{dist_promedio:.2f} km")
            
        with met3:
            score_promedio = df_filtrado['score'].mean()
            st.metric(label="Score Promedio", value=f"{score_promedio:.2f}")
        with met4:
            puntos_con_vista = df_filtrado['linea_de_vista'].sum()
            porcentaje_vista = (puntos_con_vista / total_puntos) * 100 if total_puntos > 0 else 0
            st.metric(label="Con Línea de Vista", value=f"{porcentaje_vista:.1f}")
            
        st.markdown("---")
        
        st.subheader("Distribución Geográfica e Infraestructura")
        
        if all(col in df_filtrado.columns for col in ['latitud', 'longitud']):
            fig_mapa = px.scatter_mapbox(
                df_filtrado,
                lat="latitud",
                lon="longitud",
                hover_name="nombre",
                color="grupo_institucion",
                size="score" if df_filtrado['score'].min() >= 0 else None, # Evita errores si hay scores negativos
                hover_data={
                    "distancia_torre_estatal_cercana": ":.2f km",
                    "altitud": ":.1f m",
                    "score": ":.2f",
                    "latitud": False,
                    "longitud": False
                },
                zoom=6,
                mapbox_style="carto-positron",
                height=500
            )
            fig_mapa.update_layout(margin={"r":0,"t":0,"l":0,"b":0})
            st.plotly_chart(fig_mapa, use_container_width=True)
        else:
            st.error("No se encontraron las columnas 'latitud' y 'longitud' para generar el mapa.")

        st.markdown("---")
        
        # seccion inferior graficos.
        
    else:
        st.warning("Ningún registro coincide con los criterios de los filtros seleccionados.")
else:
    st.warning("Por favor, asegúrate de colocar un archivo CSV válido en la carpeta 'data/'. ")
