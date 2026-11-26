"""Base class for every AI module (classifier, detector, segmenter, ...)."""


class BaseModule:
    name = "base"        # unique name, used by the registry
    version = "0.0"
    weights_path = None  # model file, if any

    def __init__(self):
        self._loaded = False

    def load(self):
        """Load the model once. Calling it again does nothing."""
        if self._loaded:
            return
        self._load()
        self._loaded = True

    def _load(self):
        """Child classes put their model-loading code here."""
        raise NotImplementedError("Child class must write _load()")

    def ensure_loaded(self):
        """Call this at the start of predict()."""
        if not self._loaded:
            self.load()

    @property
    def is_loaded(self):
        return self._loaded

    def info(self):
        return {
            "name": self.name,
            "version": self.version,
            "weights": str(self.weights_path) if self.weights_path else None,
            "loaded": self._loaded,
        }