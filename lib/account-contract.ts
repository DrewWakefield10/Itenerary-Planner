import {z} from "zod/v3";
import {tripSchema,type Trip} from "./trip";
export const accountIdSchema=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const saveAccountTripSchema=z.object({trip:tripSchema,revision:z.number().int().min(0),mutationId:z.string().uuid()}).strict();
export type AccountTrip={trip:Trip;ownerId:string;revision:number;createdAt:string;updatedAt:string};
export type Bookmark={placeId:string;name:string;description:string;municipality:string|null;destination:string|null;createdAt:string;available:boolean};
export class AccountError extends Error{constructor(public status:number,message:string){super(message);}}
