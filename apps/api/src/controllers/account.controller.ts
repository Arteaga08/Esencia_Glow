import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as profileService from "../services/account-profile.service.js";
import * as addressService from "../services/account-address.service.js";
import * as billingService from "../services/account-billing.service.js";
import * as wishlistService from "../services/account-wishlist.service.js";

/**
 * Controllers finos de "Mi Cuenta". Todo se deriva de `req.user.id` (la sesión):
 * ningún handler lee el id del dueño de la ruta, el body ni la query.
 */

const userId = (req: Request) => req.user!.id;

const getAccount = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "OK", await profileService.getAccount(userId(req)));
});

const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "Perfil actualizado.", await profileService.updateProfile(userId(req), req.body));
});

const createAddress = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 201, "Dirección guardada.", await addressService.addAddress(userId(req), req.body));
});

const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.updateAddress(userId(req), req.params.addressId as string, req.body);
  sendResponse(res, 200, "Dirección actualizada.", address);
});

const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const address = await addressService.setDefaultAddress(userId(req), req.params.addressId as string);
  sendResponse(res, 200, "Dirección principal actualizada.", address);
});

const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  await addressService.deleteAddress(userId(req), req.params.addressId as string);
  sendResponse(res, 200, "Dirección eliminada.", null);
});

const saveBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "Datos de facturación guardados.", await billingService.saveBillingInfo(userId(req), req.body));
});

const deleteBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "Datos de facturación eliminados.", await billingService.deleteBillingInfo(userId(req)));
});

const listWishlist = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "OK", await wishlistService.listWishlist(userId(req)));
});

const addWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const added = await wishlistService.addWishlistItem(userId(req), req.body.itemType, req.body.itemId);
  sendResponse(res, added ? 201 : 200, added ? "Guardado." : "Ya estaba guardado.", null);
});

const removeWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  await wishlistService.removeWishlistItem(userId(req), req.params.itemType as "product", req.params.itemId as string);
  sendResponse(res, 200, "Quitado de guardados.", null);
});

export {
  getAccount,
  updateProfile,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  saveBillingInfo,
  deleteBillingInfo,
  listWishlist,
  addWishlistItem,
  removeWishlistItem,
};
