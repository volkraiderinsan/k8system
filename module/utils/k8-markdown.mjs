export async function renderK8Markdown(text) {
    const html = markdownToHtml(text ?? "");
  
    return foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
      async: true,
      documents: true,
      links: true,
      rolls: true
    });
  }
  
  export function activateK8MarkdownDrop(input) {
    if (!input) return;
  
    input.addEventListener("dragover", event => {
      event.preventDefault();
      event.stopPropagation();
  
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "link";
      }
    });
  
    input.addEventListener("drop", async event => {
      event.preventDefault();
      event.stopPropagation();
  
      let data = null;
  
      try {
        data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
      } catch {
        data = null;
      }
  
      if (!data) {
        const text = event.dataTransfer?.getData("text/plain");
        if (!text) return;
  
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }
      }
  
      const uuid = data.uuid || data.uuidv4;
      if (!uuid) return;
  
      const document = await fromUuid(uuid);
      if (!document) return;
  
      const label = document.name ?? "Link";
      const link = `@UUID[${uuid}]{${label}}`;
  
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
  
      input.value =
        input.value.slice(0, start) +
        link +
        input.value.slice(end);
  
      const cursor = start + link.length;
  
      input.selectionStart = cursor;
      input.selectionEnd = cursor;
      input.focus();
    });
  }
  
  function markdownToHtml(text) {
    const escaped = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  
    const lines = escaped.split(/\r?\n/);
    const html = [];
    let inList = false;
  
    const inline = line => {
      return line
        .replace(/!img\((.*?),\s*(\d+)\)/g, '<img src="$1" class="k8-description-image" style="width: $2%;">')
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>");
    };
  
    for (const line of lines) {
      if (/^\s*-\s+/.test(line)) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
  
        html.push(`<li>${inline(line.replace(/^\s*-\s+/, ""))}</li>`);
        continue;
      }
  
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
  
      if (/^###\s+/.test(line)) {
        html.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`);
      } else if (/^##\s+/.test(line)) {
        html.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`);
      } else if (/^#\s+/.test(line)) {
        html.push(`<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`);
      } else if (line.trim() === "") {
        html.push("<br>");
      } else {
        html.push(`<p>${inline(line)}</p>`);
      }
    }
  
    if (inList) html.push("</ul>");
  
    return html.join("");
  }