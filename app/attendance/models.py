from datetime import datetime, timezone

from .db import db


def utcnow():
    return datetime.now(timezone.utc)


class Employee(db.Model):
    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    records = db.relationship("AttendanceRecord", back_populates="employee", lazy="dynamic")


class AttendanceRecord(db.Model):
    __tablename__ = "attendance_records"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False, index=True)
    check_in_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    check_out_at = db.Column(db.DateTime(timezone=True), nullable=True)
    note = db.Column(db.String(300), nullable=True)

    employee = db.relationship("Employee", back_populates="records")

    @property
    def is_open(self):
        return self.check_out_at is None
