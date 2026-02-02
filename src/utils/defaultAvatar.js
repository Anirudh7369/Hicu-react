// Default avatar placeholder - a simple gray circle with person icon
// Using data URI to avoid external requests and random people's photos

export const DEFAULT_AVATAR_URL = 'data:image/svg+xml;base64,' + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="50" fill="#4A4A4A"/>
  <circle cx="50" cy="35" r="15" fill="#FFFFFF"/>
  <path d="M 25 80 Q 25 60, 50 60 Q 75 60, 75 80 Z" fill="#FFFFFF"/>
</svg>
`.trim());
