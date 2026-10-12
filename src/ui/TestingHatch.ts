export function testingHatch(summary:HTMLElement):void {
  summary.classList.add('qa-hatch');summary.ariaLabel='開發測試工具';summary.title='開發測試工具';
  summary.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 19 9-9M3 21l2-5 3 3-5 2Z"/><path d="m12 8 4 4 4-4a2.8 2.8 0 0 0-4-4l-4 4Z"/></svg>';
}
