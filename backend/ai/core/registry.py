"""Registry: one place that knows all AI modules and their versions."""
from ai.core.base import BaseModule

_modules = {}


def register(module: BaseModule):
    _modules[module.name] = module


def get(name: str) -> BaseModule:
    if name not in _modules:
        raise KeyError(f"Module '{name}' registered nahi hai. Available: {list(_modules)}")
    return _modules[name]


def load_all():
    """Load every registered model (call once at startup)."""
    for module in _modules.values():
        module.load()


def list_models():
    return [module.info() for module in _modules.values()]


def clear():
    """Only for tests."""
    _modules.clear()