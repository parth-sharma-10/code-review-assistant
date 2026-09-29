import { ProviderType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normaliseUrl = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : value;

// require_tld: false so local servers (localhost, host.docker.internal, LAN IPs) are allowed.
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };
const URL_MESSAGE = 'baseUrl must be an http(s) URL, e.g. http://localhost:1234/v1';

export class CreateProviderDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEnum(ProviderType)
  type!: ProviderType;

  @Transform(normaliseUrl)
  @IsUrl(URL_OPTIONS, { message: URL_MESSAGE })
  @MaxLength(500)
  baseUrl!: string;

  /** Optional: LM Studio and Ollama do not require a key. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateProviderDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @Transform(normaliseUrl)
  @IsOptional()
  @IsUrl(URL_OPTIONS, { message: URL_MESSAGE })
  @MaxLength(500)
  baseUrl?: string;

  /** Omit to keep the stored key; "" to remove it; any other value replaces it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
