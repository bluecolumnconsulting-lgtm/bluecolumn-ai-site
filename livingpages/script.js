// BlueColumn Living Pages™ — interactions

// Nav background on scroll
const nav = document.getElementById("nav");
const onScroll = () => {
  if (window.scrollY > 10) nav.classList.add("scrolled");
  else nav.classList.remove("scrolled");
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
navToggle.addEventListener("click", () => {
  navToggle.classList.toggle("open");
  navLinks.classList.toggle("open");
});
// Close mobile nav when a link is clicked
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navToggle.classList.remove("open");
    navLinks.classList.remove("open");
  })
);

// Reveal on scroll
const revealEls = document.querySelectorAll(".section, .chat-demo, .strip, .quote, .footer");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal", "visible");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);
revealEls.forEach((el) => {
  el.classList.add("reveal");
  io.observe(el);
});

// Chat demo: replay the conversation when scrolled into view
const chat = document.querySelector(".chat-demo");
const msgs = chat ? chat.querySelectorAll(".msg") : [];
if (chat && msgs.length) {
  msgs.forEach((m) => (m.style.animationPlayState = "paused"));
  const chatIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          msgs.forEach((m, i) => {
            m.style.animationDelay = `${i * 0.55}s`;
            m.style.animationPlayState = "running";
          });
          chatIO.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  chatIO.observe(chat);
}
