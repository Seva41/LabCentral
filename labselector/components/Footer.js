import Image from 'next/image';
import { APP_CONFIG } from '../config';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="relative w-full text-center px-4 py-2 text-sm text-gray-300">
        <p
        >
          <a
            property="dct:title"
            rel="cc:attributionURL"
            href="https://github.com/Seva41/LabCentral"
            className="underline hover:text-blue-200"
          >
            LabCentral
          </a>{' '}
          by{' '}
          <a
            rel="cc:attributionURL dct:creator"
            property="cc:attributionName"
            href="https://sebadinator.com"
            className="underline hover:text-blue-200"
          >
            Sebastián Dinator
          </a>{' '}
          is licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/?ref=chooser-v1"
            target="_blank"
            rel="license noopener noreferrer"
            className="inline-flex items-center underline hover:text-blue-200"
          >
            CC BY-NC-SA 4.0
            <span className="ml-1 flex items-center">
              <Image
                src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"
                alt="cc"
                width={22}
                height={22}
                unoptimized
              />
              <Image
                src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"
                alt="by"
                width={22}
                height={22}
                className="ml-1"
                unoptimized
              />
              <Image
                src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1"
                alt="nc"
                width={22}
                height={22}
                className="ml-1"
                unoptimized
              />
              <Image
                src="https://mirrors.creativecommons.org/presskit/icons/sa.svg?ref=chooser-v1"
                alt="sa"
                width={22}
                height={22}
                className="ml-1"
                unoptimized
              />
            </span>
          </a>
        </p>

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 version-label">
          v{APP_CONFIG.version}
        </div>
      </div>
    </footer>
  );
}
