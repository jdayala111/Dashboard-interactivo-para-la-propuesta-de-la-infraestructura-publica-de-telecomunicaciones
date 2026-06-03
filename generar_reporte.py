import os
import pandas as pd
from src.plots import (
    generar_mapa_d1, generar_barras_d1, generar_dona_d1, construir_tabla_d1,
    generar_barras_d2, generar_histograma_d2, construir_tabla_d2
)

def exportar_plataforma_telecom(csv1_path, csv2_path, template_path, output_name="reporte_conectividad_unison.html"):
    if not os.path.exists(csv1_path) or not os.path.exists(csv2_path) or not os.path.exists(template_path):
        print("Error: Verifica que las rutas de los archivos CSV y de la plantilla HTML sean validas.")
        return

    # 1. Carga de datos con codificacion Latin-1 y limpieza de columnas
    df1 = pd.read_csv(csv1_path, encoding='latin-1')
    df2 = pd.read_csv(csv2_path, encoding='latin-1')
    df1.columns = df1.columns.str.strip()
    df2.columns = df2.columns.str.strip()

    # 2. Procesamiento del Dataset 1
    d1_total_torres = len(df1)
    d1_total_beneficiados = df1['cantidad_instituciones'].sum()
    d1_dist_media = df1['dist_km_torre_estatal_mas_cercana'].mean()
    d1_con_vista = df1['linea_vista'].sum()
    d1_pct_vista = (d1_con_vista / d1_total_torres) * 100 if d1_total_torres > 0 else 0

    # 3. Procesamiento del Dataset 2
    d2_total_inst = len(df2)
    d2_dist_media = df2['dist_km'].mean()
    d2_total_proveedores = df2['proveedor'].nunique()

    # 4. Lectura de la plantilla visual
    with open(template_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 5. Inyeccion de componentes - Pestaña 1
    html_content = html_content.replace("{{ d1_kpi_total }}", str(d1_total_torres))
    html_content = html_content.replace("{{ d1_kpi_beneficiados }}", str(d1_total_beneficiados))
    html_content = html_content.replace("{{ d1_kpi_distancia }}", f"{d1_dist_media:.2f}")
    html_content = html_content.replace("{{ d1_kpi_vista }}", f"{d1_pct_vista:.1f}%")
    html_content = html_content.replace("{{ d1_componente_mapa }}", generar_mapa_d1(df1))
    html_content = html_content.replace("{{ d1_componente_barras }}", generar_barras_d1(df1))
    html_content = html_content.replace("{{ d1_componente_dona }}", generar_dona_d1(df1))
    html_content = html_content.replace("{{ d1_componente_tabla }}", construir_tabla_d1(df1))

    # 6. Inyeccion de componentes - Pestaña 2
    html_content = html_content.replace("{{ d2_kpi_total }}", str(d2_total_inst))
    html_content = html_content.replace("{{ d2_kpi_proximidad }}", f"{d2_dist_media:.2f}")
    html_content = html_content.replace("{{ d2_kpi_proveedores }}", str(d2_total_proveedores))
    html_content = html_content.replace("{{ d2_componente_barras }}", generar_barras_d2(df2))
    html_content = html_content.replace("{{ d2_componente_histograma }}", generar_histograma_d2(df2))
    html_content = html_content.replace("{{ d2_componente_tabla }}", construir_tabla_d2(df2))

    # 7. Escritura del informe final
    with open(output_name, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    print(f"Proceso concluido. Archivo guardado como: {output_name}")

if __name__ == "__main__":
    exportar_plataforma_telecom(
        csv1_path="data/torres_propuestas_actualizado.csv",
        csv2_path="data/migraciones_posibles.csv",
        template_path="src/template.html",
        output_name="index.html"
    )
