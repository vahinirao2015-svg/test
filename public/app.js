const booksBody = document.getElementById("books-body");
const statusEl = document.getElementById("status");
const form = document.getElementById("add-form");
const formMessage = document.getElementById("form-message");

async function fetchBooks() {
  statusEl.textContent = "Loading…";
  const res = await fetch("/api/books");
  if (!res.ok) throw new Error("Could not load books");
  return res.json();
}

function renderBooks(books) {
  booksBody.innerHTML = "";

  if (!books.length) {
    booksBody.innerHTML =
      '<tr><td colspan="5" class="empty">No books yet. Add one below.</td></tr>';
    statusEl.textContent = "0 books in the database";
    return;
  }

  for (const book of books) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="title-cell"></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    `;
    const cells = tr.querySelectorAll("td");
    cells[0].textContent = book.title;
    cells[1].textContent = book.author;
    cells[2].textContent = String(book.year);
    cells[3].textContent = book.genre;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "Delete";
    del.addEventListener("click", () => onDelete(book.id));
    cells[4].appendChild(del);

    booksBody.appendChild(tr);
  }

  statusEl.textContent = `${books.length} book${books.length === 1 ? "" : "s"} in the database`;
}

async function load() {
  try {
    const books = await fetchBooks();
    renderBooks(books);
  } catch (err) {
    statusEl.textContent = err.message || "Failed to load";
  }
}

async function onDelete(id) {
  const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    statusEl.textContent = "Delete failed";
    return;
  }
  await load();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.className = "form-message";

  const data = Object.fromEntries(new FormData(form).entries());
  data.year = Number(data.year);

  try {
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      formMessage.textContent = payload.error || "Could not add book";
      formMessage.classList.add("error");
      return;
    }
    form.reset();
    formMessage.textContent = `Added “${payload.title}”`;
    formMessage.classList.add("ok");
    await load();
  } catch {
    formMessage.textContent = "Network error while adding book";
    formMessage.classList.add("error");
  }
});

load();
