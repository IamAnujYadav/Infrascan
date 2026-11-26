"""The 5 user roles of the spec."""
from enum import Enum


class Role(str, Enum):
    civil_engineer = "civil_engineer"
    inspector = "inspector"                      # Infrastructure Inspector
    maintenance_engineer = "maintenance_engineer"
    manager = "manager"                          # Infrastructure Manager
    admin = "admin"                              # Administrator


ROLE_LABELS = {
    Role.civil_engineer: "Civil Engineer",
    Role.inspector: "Infrastructure Inspector",
    Role.maintenance_engineer: "Maintenance Engineer",
    Role.manager: "Infrastructure Manager",
    Role.admin: "Administrator",
}