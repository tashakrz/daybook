import { useSyncExternalStore } from 'react'
import { AssignmentEditor, ExamEditor, ReminderEditor, EventEditor, HabitEditor, ClassEditor, AddMenu } from './editors.jsx'
import { PeriodLogSheet } from './PeriodLogSheet.jsx'

// Open any editor from anywhere: openEditor('assignment', item?, date?)
let current = null
const ls = new Set()
const set = (v) => {
  current = v
  ls.forEach((l) => l())
}
export const openEditor = (kind, item = null, date = null) => set({ kind, item, date, key: Date.now() })
export const closeEditor = () => set(null)

const EDITORS = {
  assignment: AssignmentEditor,
  exam: ExamEditor,
  reminder: ReminderEditor,
  event: EventEditor,
  habit: HabitEditor,
  class: ClassEditor,
  period: PeriodLogSheet,
}

export function EditorHost() {
  const e = useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => current)
  if (!e) return null
  if (e.kind === 'add') return <AddMenu date={e.date} onClose={closeEditor} onPick={(k, d) => openEditor(k, null, d)} />
  const C = EDITORS[e.kind]
  return <C key={e.key} item={e.item} date={e.date} onClose={closeEditor} />
}
