class APIFilters {
    constructor(query, queryStr){
        this.query = query;
        this.queryStr = queryStr;
    }

    search() {
        const keyword = this.queryStr.keyword ? {
            name: {
                $regex: this.queryStr.keyword,
                $options: "i",
            },
        } : {};

        this.query = this.query.find({ ...keyword });
        return this;
    }

    filters() {
        const queryCopy = { ...this.queryStr };

        // Fields to remove
        const fieldsToRemove = ["keyword","page"];
        fieldsToRemove.forEach((el) => delete queryCopy[el]);

        // Advance filter for price, rating, etc
        Object.keys(queryCopy).forEach((key) => {
            if (key.includes("[")) {
                const [field, operatorWithBracket] = key.split("[");
                const operator = operatorWithBracket.replace("]", "");
                if (!queryCopy[field]) {
                    queryCopy[field] = {};
                }
                queryCopy[field][`$${operator}`] = queryCopy[key];
                delete queryCopy[key];
            }
        });

        this.query = this.query.find(queryCopy);
        return this;

        console.log("================");
        console.log(queryCopy);
        console.log("================");
    }

    pagination(resPerPage){
        const currentPage = Number(this.queryStr.page) || 1;
        const skip = resPerPage * (currentPage - 1);

        this.query = this.query.limit(resPerPage).skip(skip);
        return this;
    }

}

export default APIFilters;