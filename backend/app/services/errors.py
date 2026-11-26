"""One error type for the services. main.py turns it into a normal HTTP error."""


class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code