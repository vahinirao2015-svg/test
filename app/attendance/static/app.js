document.addEventListener("DOMContentLoaded", () => {
  const firstField = document.querySelector("input[name='employee_code']");
  if (firstField) {
    firstField.focus();
  }

  document.querySelectorAll(".flash").forEach((el) => {
    window.setTimeout(() => {
      el.style.transition = "opacity 0.4s ease";
      el.style.opacity = "0";
    }, 4200);
  });
});
