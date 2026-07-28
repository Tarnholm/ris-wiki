
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
