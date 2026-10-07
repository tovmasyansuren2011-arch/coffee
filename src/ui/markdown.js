/**
 * Lightweight, robust Markdown parser and HTML renderer
 * Tailored for Coffee's note-taking with syntax highlighting styling,
 * task lists, blockquotes, tables, and clean code blocks.
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseMarkdown(markdownText = "") {
  if (!markdownText) return "";

  const lines = markdownText.split(/\r?\n/);
  const output = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent = [];
  let inList = false;
  let listType = null; // 'ul' | 'ol'
  let inTable = false;
  let tableRows = [];

  function closeList() {
    if (inList) {
      output.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    }
  }

  function closeTable() {
    if (inTable && tableRows.length > 0) {
      let tableHtml =
        '<div class="table-container"><table class="markdown-table">';
      tableRows.forEach((row, idx) => {
        const cells = row
          .split("|")
          .map((c) => c.trim())
          .filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (idx === 0) {
          tableHtml += "<thead><tr>";
          cells.forEach((c) => {
            tableHtml += `<th>${inlineFormat(c)}</th>`;
          });
          tableHtml += "</tr></thead><tbody>";
        } else if (idx === 1 && row.includes("---")) {
          // delimiter row
        } else {
          tableHtml += "<tr>";
          cells.forEach((c) => {
            tableHtml += `<td>${inlineFormat(c)}</td>`;
          });
          tableHtml += "</tr>";
        }
      });
      tableHtml += "</tbody></table></div>";
      output.push(tableHtml);
      inTable = false;
      tableRows = [];
    }
  }

  function inlineFormat(text) {
    let s = escapeHtml(text);

    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold & Italic ***text***
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");

    // Bold **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Strikethrough ~~text~~
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    // Links [label](url)
    s = s.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>',
    );

    // Auto-link raw URLs if not already linked
    s = s.replace(
      /(^|[^"'])(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$2</a>',
    );

    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code blocks
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        closeList();
        closeTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        const codeText = escapeHtml(codeBlockContent.join("\n"));
        const langBadge = codeBlockLang
          ? `<span class="code-lang">${escapeHtml(codeBlockLang)}</span>`
          : "";
        output.push(`
          <div class="code-block-wrapper">
            ${langBadge}
            <pre class="code-block"><code class="language-${escapeHtml(codeBlockLang)}">${codeText}</code></pre>
          </div>
        `);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // 2. Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      closeList();
      inTable = true;
      tableRows.push(trimmed);
      continue;
    } else if (inTable) {
      closeTable();
    }

    // 3. Headings
    if (trimmed.startsWith("#")) {
      closeList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = inlineFormat(match[2]);
        output.push(
          `<h${level} class="markdown-heading h${level}">${text}</h${level}>`,
        );
        continue;
      }
    }

    // 4. Horizontal Rule
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      output.push('<hr class="markdown-hr" />');
      continue;
    }

    // 5. Blockquotes
    if (trimmed.startsWith(">")) {
      closeList();
      const quoteText = inlineFormat(trimmed.replace(/^>\s?/, ""));
      output.push(
        `<blockquote class="markdown-blockquote"><p>${quoteText}</p></blockquote>`,
      );
      continue;
    }

    // 6. Unordered lists & task lists
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        inList = true;
        listType = "ul";
        output.push('<ul class="markdown-list">');
      }

      let content = ulMatch[1];
      if (content.startsWith("[ ] ")) {
        content = `<input type="checkbox" disabled class="task-checkbox" /> ${inlineFormat(content.slice(4))}`;
        output.push(`<li class="task-item">${content}</li>`);
      } else if (content.startsWith("[x] ") || content.startsWith("[X] ")) {
        content = `<input type="checkbox" checked disabled class="task-checkbox" /> ${inlineFormat(content.slice(4))}`;
        output.push(`<li class="task-item is-checked">${content}</li>`);
      } else {
        output.push(`<li>${inlineFormat(content)}</li>`);
      }
      continue;
    }

    // 7. Ordered lists
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        inList = true;
        listType = "ol";
        output.push('<ol class="markdown-list">');
      }
      output.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Not a list item
    closeList();

    // 8. Empty lines
    if (trimmed === "") {
      output.push('<div class="markdown-spacer"></div>');
      continue;
    }

    // 9. Regular paragraph
    output.push(`<p class="markdown-paragraph">${inlineFormat(trimmed)}</p>`);
  }

  // Ensure trailing open blocks are closed
  if (inCodeBlock) {
    const codeText = escapeHtml(codeBlockContent.join("\n"));
    output.push(`<pre class="code-block"><code>${codeText}</code></pre>`);
  }
  closeList();
  closeTable();

  return output.join("\n");
}
