from datetime import datetime, timezone

from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for

from .db import db
from .models import AttendanceRecord, Employee

bp = Blueprint("main", __name__)


def _normalize_code(value: str) -> str:
    return value.strip().upper()


@bp.get("/health")
def health():
    return {"status": "ok"}, 200


@bp.get("/")
def index():
    open_records = (
        AttendanceRecord.query.filter(AttendanceRecord.check_out_at.is_(None))
        .order_by(AttendanceRecord.check_in_at.desc())
        .limit(20)
        .all()
    )
    recent = (
        AttendanceRecord.query.order_by(AttendanceRecord.check_in_at.desc()).limit(25).all()
    )
    return render_template(
        "index.html",
        app_name=current_app.config["APP_NAME"],
        open_records=open_records,
        recent=recent,
    )


@bp.post("/check-in")
def check_in():
    code = _normalize_code(request.form.get("employee_code", ""))
    name = request.form.get("full_name", "").strip()
    note = request.form.get("note", "").strip() or None

    if not code or not name:
        flash("Employee code and full name are required.", "error")
        return redirect(url_for("main.index"))

    employee = Employee.query.filter_by(code=code).first()
    if employee is None:
        employee = Employee(code=code, full_name=name)
        db.session.add(employee)
    else:
        employee.full_name = name

    open_shift = (
        AttendanceRecord.query.filter_by(employee_id=employee.id, check_out_at=None)
        .order_by(AttendanceRecord.check_in_at.desc())
        .first()
    )
    if open_shift is not None:
        flash(f"{employee.full_name} is already checked in.", "error")
        return redirect(url_for("main.index"))

    record = AttendanceRecord(employee=employee, note=note)
    db.session.add(record)
    db.session.commit()
    flash(f"Checked in {employee.full_name} ({employee.code}).", "success")
    return redirect(url_for("main.index"))


@bp.post("/check-out")
def check_out():
    code = _normalize_code(request.form.get("employee_code", ""))
    if not code:
        flash("Employee code is required to check out.", "error")
        return redirect(url_for("main.index"))

    employee = Employee.query.filter_by(code=code).first()
    if employee is None:
        flash("No employee found for that code.", "error")
        return redirect(url_for("main.index"))

    open_shift = (
        AttendanceRecord.query.filter_by(employee_id=employee.id, check_out_at=None)
        .order_by(AttendanceRecord.check_in_at.desc())
        .first()
    )
    if open_shift is None:
        flash(f"{employee.full_name} has no open check-in.", "error")
        return redirect(url_for("main.index"))

    open_shift.check_out_at = datetime.now(timezone.utc)
    db.session.commit()
    flash(f"Checked out {employee.full_name} ({employee.code}).", "success")
    return redirect(url_for("main.index"))


@bp.get("/records")
def records():
    rows = (
        AttendanceRecord.query.order_by(AttendanceRecord.check_in_at.desc()).limit(100).all()
    )
    return render_template(
        "records.html",
        app_name=current_app.config["APP_NAME"],
        records=rows,
    )
