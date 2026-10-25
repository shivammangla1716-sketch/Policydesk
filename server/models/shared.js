export const jsonOptions = {
  virtuals: false,
  transform(_doc, value) {
    value.id = String(value._id);
    delete value._id; delete value.__v;
    delete value.password; delete value.sessionVersion; delete value.tokenHash;
    delete value.busyUntil; delete value.leaseUntil;
    return value;
  },
};
export const modelOptions = { timestamps: true, toJSON: jsonOptions };
