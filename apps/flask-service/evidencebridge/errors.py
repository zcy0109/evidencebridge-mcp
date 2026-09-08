class EvidenceBridgeError(Exception):
    status_code = 400
    code = "evidencebridge_error"


class ValidationError(EvidenceBridgeError):
    code = "validation_error"


class NotFoundError(EvidenceBridgeError):
    status_code = 404
    code = "not_found"


class UnsupportedMediaError(EvidenceBridgeError):
    status_code = 415
    code = "unsupported_media_type"


class RateLimitError(EvidenceBridgeError):
    status_code = 429
    code = "rate_limit_exceeded"
