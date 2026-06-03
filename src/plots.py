import plotly.express as px

COLOR_TINTO = "#7D0042"
COLOR_ORO = "#CC6C22"

# --- GRAFÍCOS DATASET 1: TORRES PROPUESTAS ---
def generar_mapa_d1(df) -> str:
    fig = px.scatter_mapbox(
        df,
        lat="latitud",
        lon="longitud",
        hover_name="nombre",
        color="conexion_backhaul",
        color_discrete_sequence=[COLOR_TINTO, COLOR_ORO],
        size="cantidad_instituciones",
        hover_data={
            "dist_km_torre_estatal_mas_cercana": ":.2f km",
            "cantidad_instituciones": True,
            "torre_estatal_cercana": True,
            "latitud": False,
            "longitud": False
        },
        zoom=5.8,
        mapbox_style="carto-positron",
        height=500
    )
    fig.update_layout(margin=dict(l=0, r=0, t=0, b=0))
    return fig.to_html(full_html=False, include_plotlyjs='cdn')

def generar_barras_d1(df) -> str:
    df_agrupado = df['dependencia_torre_estatal'].value_counts().reset_index(name='cantidad')
    fig = px.bar(
        df_agrupado,
        x="dependencia_torre_estatal",
        y="cantidad",
        labels={"dependencia_torre_estatal": "Dependencia", "cantidad": "Número de Torres"},
        text_auto=True
    )
    fig.update_traces(marker_color=COLOR_TINTO, textposition="outside")
    fig.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=10, r=10, t=25, b=10),
        height=350
    )
    fig.update_yaxes(showgrid=True, gridcolor="#E5E7EB")
    return fig.to_html(full_html=False, include_plotlyjs='cdn')

# Reemplaza exactamente esta funcion en src/plots.py
def generar_dona_d1(df) -> str:
    # Agrupamos los datos para estructurar el conteo de forma limpia
    df_dona = df['conexion_backhaul'].value_counts().reset_index(name='cantidad')
    
    # Usamos color_discrete_sequence con los colores exactos en orden (Verde para Directa, Oro para Repetidor)
    fig = px.pie(
        df_dona,
        names="conexion_backhaul",
        values="cantidad",
        hole=0.4,
        color_discrete_sequence=["#10B981", "#CC6C22"]
    )
    
    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10), 
        height=350, 
        paper_bgcolor="rgba(0,0,0,0)",
        showlegend=True
    )
    
    # Forzamos a ocultar cualquier texto residual de configuracion en el renderizado
    return fig.to_html(full_html=False, include_plotlyjs='cdn')


# Filtrar
# Reemplaza la función construir_tabla_d1 en src/plots.py
def construir_tabla_d1(df) -> str:
    html_rows = ""
    for _, row in df.iterrows():
        status_class = "badge-true" if row['linea_vista'] else "badge-false"
        status_text = "Directa" if row['linea_vista'] else "Obstruida"
        
        html_rows += f"""
        <tr data-vista="{status_text}">
            <td><strong>{str(row['grupo']).upper()}</strong></td>
            <td>{row['nombre']}</td>
            <td>{row['dist_km_torre_estatal_mas_cercana']:.2f}</td>
            <td>{int(row['cantidad_instituciones'])}</td>
            <td>{row['torre_estatal_cercana']} ({row['dependencia_torre_estatal']})</td>
            <td><span class="{status_class}">{status_text}</span></td>
        </tr>
        """
    return html_rows

def generar_barras_d2(df) -> str:
    # Tomamos los 10 proveedores principales para no saturar la pantalla
    df_prov = df['proveedor'].value_counts().reset_index(name='cantidad')
    fig = px.bar(
        df_prov,
        y="proveedor",
        x="cantidad",
        orientation="h",
        labels={"proveedor": "Proveedor Comercial", "cantidad": "Enlaces Contratados"},
        text_auto=True
    )
    fig.update_traces(marker_color=COLOR_TINTO, textposition="outside")
    fig.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=10, r=10, t=25, b=10),
        height=350
    )
    fig.update_xaxes(showgrid=True, gridcolor="#E5E7EB")
    return fig.to_html(full_html=False, include_plotlyjs='cdn')

def generar_histograma_d2(df) -> str:
    fig = px.histogram(
        df,
        x="dist_km",
        nbins=20,
        labels={"dist_km": "Distancia a la red (km)", "count": "Cantidad de Instituciones"}
    )
    fig.update_traces(marker_color=COLOR_ORO)
    fig.update_layout(
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=10, r=10, t=25, b=10),
        height=350
    )
    fig.update_yaxes(showgrid=True, gridcolor="#E5E7EB")
    return fig.to_html(full_html=False, include_plotlyjs='cdn')

def construir_tabla_d2(df) -> str:
    html_rows = ""
    # Mostramos los primeros 100 registros en el HTML para mantener un rendimiento óptimo en la carga
    for _, row in df.head(100).iterrows():
        id_inst = row.iloc[0]

        
        html_rows += f"""
        <tr>
            <td>{id_inst}</td>
            <td>{row['institucion']}</td>
            <td><strong>{str(row['proveedor']).upper()}</strong></td>
            <td>{row['torre_cercana']}</td>
            <td>{row['dist_km']:.2f}</td>
        </tr>
        """
    return html_rows
