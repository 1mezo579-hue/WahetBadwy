import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function assertAdminOrManager() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      authorized: false,
      error: "يجب تسجيل الدخول أولاً للوصول إلى هذه العملية.",
      user: null,
    };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return {
      authorized: false,
      error: "غير مصرح لك بتنفيذ هذه العملية الإدارية. العملية تتطلب صلاحية مدير أو أدمن.",
      user: session.user,
    };
  }

  return {
    authorized: true,
    user: session.user,
  };
}

export async function assertAdminOnly() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      authorized: false,
      error: "يجب تسجيل الدخول أولاً للوصول إلى هذه العملية.",
      user: null,
    };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return {
      authorized: false,
      error: "غير مصرح لك. هذه العملية مقتصرة حصرياً على مدير النظام (الأدمن).",
      user: session.user,
    };
  }

  return {
    authorized: true,
    user: session.user,
  };
}
