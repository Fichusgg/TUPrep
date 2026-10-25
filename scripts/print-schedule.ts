/** npm run schedule:print — prints the generated week-by-week plan (regenerated from config/schedule.config.ts). */
import { buildSchedule } from "../src/lib/schedule";

const weeks = buildSchedule();
for (const w of weeks) {
  const planned = w.tasks.reduce((s, t) => s + t.minutes, 0);
  console.log(`\nWeek ${w.index + 1}  ${w.start} → ${w.end}  ${w.phase.id} ${w.phase.title}  [${w.kind}${w.optionalExtra ? ", optional" : ""}]  budget ${w.hours} h, planned ${(planned / 60).toFixed(1)} h`);
  if (w.focus.length) console.log(`  focus: ${w.focus.join(", ")}`);
  for (const t of w.tasks) console.log(`  ${t.date}  ${String(t.minutes).padStart(3)}m  [${t.kind}] ${t.title}`);
  console.log(`  ✓ checkpoint: ${w.checkpoint.text}`);
}
