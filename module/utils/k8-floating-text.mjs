export function k8FloatingText(event, message, type = "warn") {
    console.warn(message);
  
    const text = document.createElement("div");
  
    text.classList.add("k8-floating-text", `k8-floating-text-${type}`);
    text.textContent = message;
  
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;
  
    text.style.left = `${x}px`;
    text.style.top = `${y}px`;
  
    document.body.appendChild(text);
  
    text.addEventListener("animationend", () => {
      text.remove();
    });
  }