const origin = process.env.API_ORIGIN ?? "http://127.0.0.1:3001";
const deadline = Date.now() + 60_000;

async function waitForApi() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return console.log(`API siap di ${origin}`);
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error(`API belum siap setelah 60 detik: ${origin}`);
  process.exitCode = 1;
}

void waitForApi();
