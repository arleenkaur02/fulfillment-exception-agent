import { ExceptionRecord } from "./types";

const exceptions: ExceptionRecord[] = [];

export function addException(record: ExceptionRecord): void {
  exceptions.push(record);
}

export function getAllExceptions(): ExceptionRecord[] {
  return exceptions;
}

export function getExceptionById(id: string): ExceptionRecord | undefined {
  return exceptions.find((r) => r.id === id);
}
