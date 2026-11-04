export async function runLoadingSteps<T>(steps: Generator<void, T>): Promise<T> {
  let started = performance.now();
  while (true) {
    const step = steps.next();
    if (step.done) return step.value;
    if (performance.now() - started >= 8) {
      // Let the current animation paint before continuing scene construction.
      await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      started = performance.now();
    }
  }
}
