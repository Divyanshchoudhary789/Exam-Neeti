/**
 * Extracts and normalizes pagination parameters from query string.
 * Enforces a maximum page size to prevent abuse.
 */
const getPaginationParams = (query, maxLimit = 100) => {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Builds the pagination meta object for responses.
 */
const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = { getPaginationParams, buildPaginationMeta };
