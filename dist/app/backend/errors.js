"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegraNegocioError = void 0;
class RegraNegocioError extends Error {
    constructor(message) {
        super(message);
        this.name = "RegraNegocioError";
    }
}
exports.RegraNegocioError = RegraNegocioError;
//# sourceMappingURL=errors.js.map