
// Theme choice persists across pages; the OS preference is the default.
(function(){
  var k="ris-wiki-theme", s=localStorage.getItem(k);
  if(s) document.documentElement.setAttribute("data-theme", s);
  document.getElementById("theme").addEventListener("click", function(){
    var cur = document.documentElement.getAttribute("data-theme");
    if(!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(k, next);
  });
  // "/" focuses search, as on every docs site.
  document.addEventListener("keydown", function(e){
    if(e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){
      e.preventDefault(); document.querySelector('.top input').focus();
    }
  });

  // ── deal the tables to the window that is actually open ────────────────────
  // The server decides how many copies of a narrow table fit across the page from an ESTIMATE of
  // a width it cannot know. On a window narrower than the estimate assumes, three lists that
  // were meant to sit side by side do not, and the page is wrong for the person reading it. So
  // the server's answer is only the starting position: here it is measured and redone, and
  // redone again when the window changes.
  //
  // Reads in one pass and writes in one pass. There are pages here carrying 156 tables, and
  // interleaving a measurement with a rebuild per table would force 156 reflows; setting them
  // all flat, then reading all the widths, then rebuilding all, costs two.
  (function deal(){
    var tws = [].slice.call(document.querySelectorAll(".tw[data-cols]"));
    if (!tws.length) return;

    function capture(tw){
      var t = tw.querySelector("table");
      if (!t || !t.tHead || !t.tBodies[0]) return null;
      var cols = +tw.getAttribute("data-cols"), up = +tw.getAttribute("data-up") || 1;
      var hc = t.tHead.rows[0].cells, head = [], klass = [];
      for (var k = 0; k < cols; k++) {
        head.push(hc[k] ? hc[k].innerHTML : "");
        // The alignment class lives on every cell of a column; take it from the heading, and
        // drop "grp", which marks where a GROUP starts and is re-applied when dealing.
        klass.push(hc[k] ? hc[k].className.replace(/grp/, "").trim() : "");
      }
      var rows = [];
      [].forEach.call(t.tBodies[0].rows, function(r){
        for (var g = 0; g < up; g++) {
          var cells = [], any = false;
          for (var k = 0; k < cols; k++) {
            var c = r.cells[g * cols + k];
            cells.push(c ? c.innerHTML : "");
            if (c && c.innerHTML.replace(/s|&nbsp;/g, "")) any = true;
          }
          // Padding cells from the previous deal are dropped rather than kept as blank rows.
          if (any) rows.push(cells);
        }
      });
      return { t: t, cols: cols, head: head, klass: klass, rows: rows };
    }

    function render(d, up){
      var cell = function(tag, html, k, first){
        var c = (d.klass[k] + (first && k === 0 ? " grp" : "")).trim();
        return "<" + tag + (c ? ' class="' + c + '"' : "") + ">" + html + "</" + tag + ">";
      };
      var th = "", g, k, r;
      for (g = 0; g < up; g++) for (k = 0; k < d.cols; k++) {
        // A group with no row in it gets blank headings — not a repeat of them over nothing.
        th += cell("th", g < d.rows.length ? d.head[k] : "", k, g > 0);
      }
      var body = "", n = Math.ceil(d.rows.length / up);
      for (r = 0; r < n; r++) {
        body += "<tr>";
        for (g = 0; g < up; g++) {
          var row = d.rows[r * up + g];
          for (k = 0; k < d.cols; k++) body += cell("td", row ? row[k] : "", k, g > 0);
        }
        body += "</tr>";
      }
      d.t.tHead.rows[0].innerHTML = th;
      d.t.tBodies[0].innerHTML = body;
    }

    var state = [];
    tws.forEach(function(tw){
      var d = capture(tw);
      if (d && d.rows.length) { state.push({ tw: tw, d: d, up: 0, one: 0 }); }
    });
    if (!state.length) return;

    function layout(first){
      if (first) {
        state.forEach(function(s){ render(s.d, 1); s.tw.classList.remove("multi"); });
        // One read pass, after one write pass.
        state.forEach(function(s){
          s.one = s.d.t.offsetWidth;
          s.avail = (s.tw.parentNode && s.tw.parentNode.clientWidth) || s.one;
        });
      } else {
        state.forEach(function(s){ s.avail = (s.tw.parentNode && s.tw.parentNode.clientWidth) || s.one; });
      }
      state.forEach(function(s){
        // 7px is what a group costs beyond its own columns: its first cell takes 1.1rem of left
        // padding where the others take .7rem.
        var up = Math.max(1, Math.min(4, Math.floor(s.avail / (s.one + 7)) || 1));
        if (up === s.up) return;              // nothing to rebuild at this width
        s.up = up;
        render(s.d, up);
        s.tw.classList.toggle("multi", up > 1);
        s.tw.classList.toggle("scroll", s.one > s.avail);
      });
    }

    layout(true);
    var timer = null, was = window.innerWidth;
    window.addEventListener("resize", function(){
      if (window.innerWidth === was) return;   // a vertical-only resize changes nothing here
      was = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(function(){ layout(false); }, 120);
    });
  })();

  // The jump strip marks where you are. On a page of 22 sections the strip otherwise tells you
  // where you could go and nothing about where you have got to, and the strip itself scrolls
  // sideways — so the current entry is brought into view rather than left off the end of it.
  //
  // IntersectionObserver rather than a scroll handler: a scroll handler on a 4,000-row page
  // fires on every frame and has to measure each heading, which is what made the pointer
  // stutter on the big tables before. This does the work only when a heading crosses the line.
  var strip = document.querySelector(".jump");
  if (strip && window.IntersectionObserver) {
    var links = {}, order = [], seen = {};
    Array.prototype.forEach.call(strip.querySelectorAll("a"), function(a){
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      links[id] = a; order.push(id);
    });
    var mark = function(){
      var active = null;
      for (var i = 0; i < order.length; i++) if (seen[order[i]]) active = order[i];
      Array.prototype.forEach.call(strip.querySelectorAll("a.on"), function(a){ a.classList.remove("on"); });
      if (active && links[active]) {
        links[active].classList.add("on");
        var a = links[active], l = a.offsetLeft, r = l + a.offsetWidth;
        if (l < strip.scrollLeft || r > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: Math.max(0, l - strip.clientWidth / 3), behavior: "smooth" });
        }
      }
    };
    // The trigger line sits just under the bar. A heading counts as reached once its top passes
    // it, and stops counting when it scrolls back below — so "active" is the last one crossed.
    var top = parseFloat(getComputedStyle(document.body).getPropertyValue("--topbar")) || 3.1;
    var px = top * parseFloat(getComputedStyle(document.documentElement).fontSize || 16);
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ seen[e.target.id] = e.boundingClientRect.top < px + 8; });
      mark();
    }, { rootMargin: (-Math.round(px) - 8) + "px 0px 0px 0px", threshold: 0 });
    order.forEach(function(id){ var el = document.getElementById(id); if (el) io.observe(el); });
  }
})();

// ── static-export additions ──────────────────────────────────────────────────
(function(){
  var base = window.RIS_BASE || "";
  var form = document.querySelector(".top form");
  if (form) {
    var input = form.querySelector("input");
    // On a web host the plain GET works: search.html?q=… . Under file:// a form GET does not
    // reliably carry a query string, so the submit is intercepted and the term travels in the
    // hash, which every browser keeps. search.html reads whichever arrived.
    form.addEventListener("submit", function(e){
      var q = (input && input.value || "").trim();
      if (!q) { e.preventDefault(); return; }
      if (location.protocol === "file:") {
        e.preventDefault();
        location.href = base + "search.html#q=" + encodeURIComponent(q);
      }
    });
  }
})();

// ── team notes, fetched at view time ─────────────────────────────────────────
// A note written on the GitHub wiki reaches this site through a CI job that CANNOT rebuild
// the site: the 222 MB of RIS source a rebuild needs lives on rtris.org, which a GitHub
// runner cannot reach. So the job publishes each note as a small pre-rendered fragment and
// the page fetches its own when it loads. wiki-notes/index.json lists which pages have one,
// so a page with no note makes no second request, and the whole thing is skipped when a full
// local rebuild has already merged the note into the HTML.
(function () {
  try {
    if (location.protocol === "file:") return;              // an offline copy is a snapshot
    if (document.getElementById("team-notes")) return;      // a rebuild already merged it
    var main = document.querySelector("main");
    if (!main || typeof fetch !== "function") return;

    var rootPath = new URL(base || "./", location.href).pathname;
    var here = decodeURIComponent(location.pathname);
    if (here.indexOf(rootPath) !== 0) return;
    var key = here.slice(rootPath.length).replace(/.html?$/, "");
    if (!key || key === "index") key = "README";

    fetch(base + "wiki-notes/index.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (idx) {
        if (!idx || !idx[key]) return null;
        return fetch(base + "wiki-notes/" + encodeURIComponent(idx[key]) + ".html", { cache: "no-cache" });
      })
      .then(function (r) { return r && r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var sec = document.createElement("section");
        sec.className = "sec";
        sec.innerHTML = '<h2 id="team-notes">Team notes</h2>' + html;
        main.appendChild(sec);
        var jump = document.querySelector(".jump");
        if (jump && !jump.querySelector('a[href="#team-notes"]')) {
          var a = document.createElement("a");
          a.href = "#team-notes";
          a.textContent = "Team notes";
          jump.appendChild(a);
        }
      })
      .catch(function () {});   // a missing notes folder is normal, not an error
  } catch (e) {}
})();
