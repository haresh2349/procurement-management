import type { UserDocument } from './user.model.js';
import { User } from './user.model.js';
import type { CreateUserPersistenceInput, UserResponse } from './user.types.js';

export const toUserResponse = (user: UserDocument): UserResponse => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  managerId: user.managerId?.toString(),
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const findById = async (id: string): Promise<UserDocument | null> => {
  return User.findById(id);
};

export const findUsers = async (filter: Record<string, unknown>): Promise<UserDocument[]> => {
  return User.find(filter).sort({ createdAt: -1 });
};

export const findUsersPaginated = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<{ users: UserDocument[]; total: number }> => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, total };
};

export const updateInspectionManagerManagerId = async (
  inspectionManagerId: string,
  managerId: string | null,
): Promise<UserDocument | null> => {
  if (managerId === null) {
    return User.findByIdAndUpdate(
      inspectionManagerId,
      { $unset: { managerId: '' } },
      { returnDocument: 'after', runValidators: true },
    );
  }

  return User.findByIdAndUpdate(
    inspectionManagerId,
    { managerId },
    { returnDocument: 'after', runValidators: true },
  );
};

export const findByEmail = async (email: string): Promise<UserDocument | null> => {
  return User.findOne({ email: email.toLowerCase() });
};

export const findByMobile = async (mobile: string): Promise<UserDocument | null> => {
  return User.findOne({ mobile });
};

export const findByEmailWithPassword = async (email: string): Promise<UserDocument | null> => {
  return User.findOne({ email: email.toLowerCase() }).select('+password');
};

export const findByMobileWithPassword = async (mobile: string): Promise<UserDocument | null> => {
  return User.findOne({ mobile }).select('+password');
};

export const createUser = async (input: CreateUserPersistenceInput): Promise<UserDocument> => {
  return User.create({
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    password: input.passwordHash,
    role: input.role,
    managerId: input.managerId,
    createdBy: input.createdBy,
  });
};

export const countAdmins = async (): Promise<number> => {
  return User.countDocuments({ role: 'ADMIN' });
};

export const createAdmin = async (input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserDocument> => {
  return User.create({
    name: input.name,
    email: input.email,
    password: input.passwordHash,
    role: 'ADMIN',
  });
};
