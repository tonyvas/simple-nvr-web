class BadRequestError extends Error {
    constructor(message){
        super(message);
        this.name = 'BadRequestError';
    }
}

class NotFoundError extends Error {
    constructor(message){
        super(message);
        this.name = 'NotFoundError';
    }
}

module.exports = { BadRequestError, NotFoundError }