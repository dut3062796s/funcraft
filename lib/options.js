'use strict';

const parseParamToList = (cur, res) => {
  if (!res) {
    return [cur];
  }
  res.push(cur);
  return res;
};

module.exports = {
  parseParamToList
};