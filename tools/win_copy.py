"""Copia un archivo bloqueado por otro proceso en Windows usando CreateFileW
con FILE_SHARE_READ|WRITE|DELETE (util para la base Cookies de Chrome en uso).
IMPORTANTE: hay que declarar argtypes/restype o ctypes trunca el HANDLE a 32 bits.
"""
import ctypes
import ctypes.wintypes as wt

GENERIC_READ = 0x80000000
OPEN_EXISTING = 3
FILE_SHARE_READ = 0x1
FILE_SHARE_WRITE = 0x2
FILE_SHARE_DELETE = 0x4
FILE_ATTRIBUTE_NORMAL = 0x80
INVALID = ctypes.c_void_p(-1).value

k32 = ctypes.WinDLL("kernel32", use_last_error=True)
k32.CreateFileW.argtypes = [wt.LPCWSTR, wt.DWORD, wt.DWORD, ctypes.c_void_p,
                            wt.DWORD, wt.DWORD, wt.HANDLE]
k32.CreateFileW.restype = wt.HANDLE
k32.ReadFile.argtypes = [wt.HANDLE, ctypes.c_void_p, wt.DWORD,
                         ctypes.POINTER(wt.DWORD), ctypes.c_void_p]
k32.ReadFile.restype = wt.BOOL
k32.CloseHandle.argtypes = [wt.HANDLE]
k32.CloseHandle.restype = wt.BOOL


def copy_locked(src, dst):
    h = k32.CreateFileW(str(src), GENERIC_READ,
                        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                        None, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, None)
    if not h or h == INVALID:
        raise OSError(f"CreateFileW fallo ({ctypes.get_last_error()}): {src}")
    try:
        buf = ctypes.create_string_buffer(1 << 20)
        read = wt.DWORD(0)
        with open(dst, "wb") as out:
            while True:
                if not k32.ReadFile(h, buf, len(buf), ctypes.byref(read), None):
                    raise OSError(f"ReadFile fallo ({ctypes.get_last_error()})")
                if read.value == 0:
                    break
                out.write(buf.raw[:read.value])
    finally:
        k32.CloseHandle(h)
    return dst


if __name__ == "__main__":
    import sys
    print(copy_locked(sys.argv[1], sys.argv[2]))
