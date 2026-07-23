"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateBr = formatDateBr;
exports.formatFileDate = formatFileDate;
exports.isSameDay = isSameDay;
function formatDateBr(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}
function formatFileDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function isSameDay(left, right) {
    return (left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate());
}
//# sourceMappingURL=format.js.map