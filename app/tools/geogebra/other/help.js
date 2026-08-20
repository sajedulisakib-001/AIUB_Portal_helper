const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const sections = navLinks
  .map(link => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActive(id) {
  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
  });
}

// Smooth scroll on click instead of an instant jump.
navLinks.forEach(link => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", link.getAttribute("href"));
  });
});

// Highlight whichever section is currently in view as the user scrolls.
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActive(entry.target.id);
      }
    });
  },
  { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
);

sections.forEach(section => observer.observe(section));

// Highlight the right section on initial load if the URL has a hash.
if (location.hash) {
  const initial = document.querySelector(location.hash);
  if (initial) {
    setActive(initial.id);
    initial.scrollIntoView({ block: "start" });
  }
} else if (navLinks[0]) {
  navLinks[0].classList.add("active");
}
