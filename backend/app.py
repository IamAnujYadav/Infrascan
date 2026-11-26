import gradio as gr
from app.main import app as fastapi_app

with gr.Blocks(title="InfraScan API") as demo:
    gr.Markdown("# InfraScan AI Backend is Live\nOpen /docs for Swagger API documentation or /api/health for status.")

app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")
