module.exports = class Source{
    constructor(id, name, path){
        this.id = id;
        this.name = name;
        this.path = path;
    }

    static fromDatabaseObject(row){
        return new Source(row['source_id'], row['name'], row['path'])
    }
}