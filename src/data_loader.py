import pandas as pd
import streamlit as st

@st.cache_data
def load_csv_data(file_path: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(file_path)
        
#        if 'score' in df.columns:
#            df['score'] = df['score'].round(2)

        return df
    except Exception as e:
        st.error(f"Error al cargar el archivo CSV: {e}")
        return pd.DataFrame()
