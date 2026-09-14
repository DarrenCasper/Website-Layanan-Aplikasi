// UserId is global variable so we can find them easily in route (after auth)
export declare global{
    namespace Express{
        interface Request{
            userId?: string;
        }
    }
}