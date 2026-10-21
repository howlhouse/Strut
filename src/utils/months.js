export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
export const monthLongLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
