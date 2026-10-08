// Backup automatico do ZapFarm: SQLite + sessoes Baileys.
// Estrategia: snapshot do banco via API de backup do better-sqlite3 (segura
// mesmo com escritas concorrentes) + copia dos arquivos de sessao, gravados
// em DATA_DIR/backups com rotacao (mantem N dias).
//
// Variaveis de ambiente:
//   BACKUP_DIR       - destino (padrao: DATA_DIR/backups)
//   BACKUP_KEEP_DAYS - dias de backup a manter (padrao: 7)
//   BACKUP_HOUR_UTC  - hora do dia (UTC) para o backup diario (padrao: 3)
//
// Em producao (Coolify): aponte um volume persistente para o diretorio de
// backup ou monte um storage externo; idealmente copie os arquivos para fora
// da VPS (S3, outro servidor) - o backup na mesma maquina nao salva de
// perda total do disco.

const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
const backupDir = process.env.BACKUP_DIR || path.join(dataDir, 'backups');
const keepDays = Number(process.env.BACKUP_KEEP_DAYS) || 7;
const backupHourUTC = Number(process.env.BACKUP_HOUR_UTC) || 3;

function ensureDirs() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
}

// Executa um backup completo agora. Retorna Promise<string> com o diretorio criado.
async function runBackupNow(label = 'manual') {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(backupDir, `${stamp}_${label}`);
  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Snapshot consistente do SQLite (API de backup nativa do better-sqlite3:
  //    copia pagina a pagina com trava de escrita minima, arquivo integro)
  const backupDbPath = path.join(targetDir, 'zapfarm.db');
  await db.backup(backupDbPath);

  // 2. Copia das sessoes Baileys (creds + keys de cada tenant)
  const sessionsSrc = path.join(dataDir, 'sessions');
  if (fs.existsSync(sessionsSrc)) {
    fs.cpSync(sessionsSrc, path.join(targetDir, 'sessions'), { recursive: true });
  }

  // 3. Manifesto com metadados
  const manifest = {
    createdAt: new Date().toISOString(),
    label,
    dbFile: 'zapfarm.db',
    sessionsIncluded: fs.existsSync(sessionsSrc),
    fileSizeBytes: fs.statSync(backupDbPath).size,
  };
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`[Backup] Backup criado: ${targetDir} (db: ${(manifest.fileSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  return targetDir;
}

// Remove backups mais antigos que keepDays dias
function pruneOldBackups() {
  ensureDirs();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of fs.readdirSync(backupDir)) {
    const full = path.join(backupDir, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.rmSync(full, { recursive: true, force: true });
        removed++;
      }
    } catch (e) {
      // ignora entradas ilegiveis
    }
  }
  if (removed > 0) {
    console.log(`[Backup] ${removed} backup(s) antigo(s) removido(s) (politica: ${keepDays} dias).`);
  }
}

// Agenda o backup diario: checa a cada 30 min se cruzou a hora-alvo e
// executa uma vez por dia (registro da ultima execucao em arquivo marker).
function scheduleDailyBackup() {
  const markerPath = path.join(backupDir, '.last-daily-run');
  const check = () => {
    try {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      let lastRun = '';
      if (fs.existsSync(markerPath)) {
        lastRun = fs.readFileSync(markerPath, 'utf8').trim();
      }
      const isPastBackupHour = now.getUTCHours() >= backupHourUTC;
      if (isPastBackupHour && lastRun !== todayKey) {
        runBackupNow('daily');
        pruneOldBackups();
        ensureDirs();
        fs.writeFileSync(markerPath, todayKey);
      }
    } catch (e) {
      console.error('[Backup] Erro no backup diario:', e.message);
    }
  };

  // primeira checagem apos 2 min de boot, depois a cada 30 min
  setTimeout(check, 2 * 60 * 1000);
  setInterval(check, 30 * 60 * 1000);
  console.log(`[Backup] Backup diario agendado para ${String(backupHourUTC).padStart(2, '0')}:00 UTC (retencao: ${keepDays} dias). Destino: ${backupDir}`);
}

module.exports = { runBackupNow, pruneOldBackups, scheduleDailyBackup, backupDir };
