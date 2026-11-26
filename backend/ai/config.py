"""AI settings. Values change here, not inside module code."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_DIR = BASE_DIR / "weights"

# Default folder where AI outputs (mask, overlay, boxes image) are saved.
DEFAULT_OUTPUT_DIR = BASE_DIR.parent / "storage"

# ---------------- Model files ----------------
CLASSIFIER_PATH = WEIGHTS_DIR / "resnet50_crack_B_finetuned.keras"
SEGMENTER_PATH = WEIGHTS_DIR / "unet_resnet50_crack500.keras"
DETECTOR_PATH = WEIGHTS_DIR / "best.pt"

# ---------------- Model versions (spec: model versioning) ----------------
CLASSIFIER_VERSION = "v1.0"   # ResNet50 crack classification
DETECTOR_VERSION = "v1.1"     # YOLOv8s crack / road damage detection
SEGMENTER_VERSION = "v2.0"    # U-Net (ResNet50) crack segmentation
PIPELINE_VERSION = "0.1.0"

# ---------------- Prediction settings ----------------
CLASSIFIER_THRESHOLD = 0.5    # crack probability >= this -> CRACK
SEGMENTER_THRESHOLD = 0.5     # mask pixel >= this -> crack pixel
SEGMENTER_MIN_COMPONENT_FRACTION = 0.0002 
# A real crack is thin and long. Thick blobs (shadows, patches, dark bands) are removed.
CRACK_MIN_LENGTH_FRACTION = 0.04   # piece length must be at least 4% of the image diagonal
CRACK_MAX_WIDTH_FRACTION = 0.028   # piece average width must be at most 2.8% of the image short side
DETECTOR_CONF = 0.25          # YOLO minimum confidence
DETECTOR_LOW_CONF = 0.5  

# Preprocessing must match what was used in training.
# (Defaults are the ones used in our test run.)
CLASSIFIER_USE_PREPROCESS = False   # True -> resnet50.preprocess_input
CLASSIFIER_DIV_255 = False          # True -> image / 255
SEGMENTER_USE_PREPROCESS = False
SEGMENTER_DIV_255 = False

# ---------------- Image quality checks (Stage 2) ----------------
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_MB = 20
MIN_IMAGE_SIDE = 224          # smaller side in pixels
BLUR_THRESHOLD = 800.0         # Laplacian variance below this -> blurry (tune later)
LOW_LIGHT_THRESHOLD = 50      # mean brightness (0-255) below this -> too dark

# ---------------- Text shown with every result ----------------
DISCLAIMER = (
    "AI-based assessment for inspection support only. "
    "It is not a structural safety evaluation. "
    "A qualified engineer must review the findings."
)

MIN_CONTRAST_STD = 10         # std of brightness below this -> almost blank image
BLUR_CHECK_WIDTH = 512        # image is resized to this width before blur check