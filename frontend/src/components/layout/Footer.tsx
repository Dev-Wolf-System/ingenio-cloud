export function Footer() {
  return (
    <footer className="py-4 px-4 text-center border-t border-border">
      <p className="text-2xs text-text-muted">
        © {new Date().getFullYear()} Ingenio Cloud — Todos los derechos reservados · Desarrollado por{' '}
        <a
          href="https://devwolf.srv878399.hstgr.cloud/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-light hover:underline"
        >
          Dev Wolf Soluciones IT
        </a>
      </p>
    </footer>
  );
}
